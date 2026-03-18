import { createGateway } from "@ai-sdk/gateway";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";

const gateway = createGateway();

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_HISTORY: Record<string, {
  userId: string;
  totalSent: number;
  lastContactedAt: string | null;
  messagesSent: Array<{ channel: string; sentAt: string; trigger: string; opened: boolean }>;
}> = {
  default: {
    userId: "user_001",
    totalSent: 1,
    lastContactedAt: "2025-03-10T09:00:00Z",
    messagesSent: [
      { channel: "email", sentAt: "2025-03-10T09:00:00Z", trigger: "welcome_sequence", opened: true },
    ],
  },
  user_active: {
    userId: "user_active",
    totalSent: 3,
    lastContactedAt: "2025-03-14T09:00:00Z",
    messagesSent: [
      { channel: "email", sentAt: "2025-03-14T09:00:00Z", trigger: "day_3_nudge", opened: false },
      { channel: "in-app", sentAt: "2025-03-13T14:00:00Z", trigger: "welcome_sequence", opened: true },
      { channel: "email", sentAt: "2025-03-12T09:00:00Z", trigger: "welcome_email", opened: true },
    ],
  },
};

const MOCK_SUPPRESSION: Record<string, {
  suppressed: boolean;
  reason: string | null;
  suppressedChannels: string[];
  expiresAt: string | null;
}> = {
  default: { suppressed: false, reason: null, suppressedChannels: [], expiresAt: null },
  user_bounced: {
    suppressed: true,
    reason: "hard_bounce",
    suppressedChannels: ["email"],
    expiresAt: null,
  },
};

const SIGNAL_WEIGHTS: Record<string, number> = {
  no_deploy_3_days: 2,
  no_deploy_7_days: 3,
  rate_limit_hit: 2,
  rate_limit_hit_multiple: 3,
  team_size_grew: 2,
  api_calls_high: 1,
  opened_previous_email: -1,
  contacted_recently: -1,
};

// ── Tools ─────────────────────────────────────────────────────────────────────

const tools = {
  get_user_history: tool({
    description:
      "Returns the message history for a user — what was sent, when, and on which channel. Call this first to understand prior contact.",
    inputSchema: z.object({
      userId: z.string().describe("The user ID to look up message history for"),
    }),
    execute: async ({ userId }) => {
      return MOCK_HISTORY[userId] ?? MOCK_HISTORY["default"];
    },
  }),

  check_suppression: tool({
    description:
      "Checks whether a user is opted out or suppressed from receiving messages on a given channel. Always call this before sending.",
    inputSchema: z.object({
      userId: z.string().describe("The user ID to check suppression for"),
      channel: z.enum(["email", "in-app", "both"]).describe("Which channel(s) to check"),
    }),
    execute: async ({ userId }) => {
      return MOCK_SUPPRESSION[userId] ?? MOCK_SUPPRESSION["default"];
    },
  }),

  score_urgency: tool({
    description:
      "Returns an urgency score (1-5) for this user based on behavioral signals. Higher = more urgent to contact.",
    inputSchema: z.object({
      userId: z.string().describe("The user ID to score"),
      trigger: z.string().describe("The lifecycle trigger key, e.g. 'no_deploy_3_days'"),
      signals: z
        .array(z.string())
        .describe("Behavioral signal keys to factor in, e.g. ['rate_limit_hit', 'team_size_grew']"),
    }),
    execute: async ({ trigger, signals }) => {
      let score = 2;
      const factors: Array<{ signal: string; weight: number; label: string }> = [];

      const triggerKey = trigger.toLowerCase().replace(/\s+/g, "_");
      if (SIGNAL_WEIGHTS[triggerKey] !== undefined) {
        score += SIGNAL_WEIGHTS[triggerKey];
        factors.push({ signal: triggerKey, weight: SIGNAL_WEIGHTS[triggerKey], label: trigger });
      }

      for (const signal of signals) {
        const key = signal.toLowerCase().replace(/\s+/g, "_");
        if (SIGNAL_WEIGHTS[key] !== undefined) {
          score += SIGNAL_WEIGHTS[key];
          factors.push({ signal: key, weight: SIGNAL_WEIGHTS[key], label: signal });
        }
      }

      score = Math.max(1, Math.min(5, score));

      const recommendation =
        score >= 4
          ? "High urgency — send email + in-app within 24h"
          : score >= 3
          ? "Moderate urgency — send in-app now, queue email"
          : "Low urgency — in-app nudge only, avoid over-messaging";

      return { score, factors, recommendation };
    },
  }),

  decide_channel: tool({
    description:
      "Call this to commit your final channel decision with reasoning. Must be called after checking suppression and urgency. This locks in your decision.",
    inputSchema: z.object({
      channel: z
        .enum(["email", "in-app", "both", "none"])
        .describe("The channel(s) to use for this activation message"),
      reasoning: z
        .string()
        .describe("1-2 sentences explaining why this channel was chosen based on the data"),
      urgency: z.number().min(1).max(5).describe("The urgency score 1-5 you determined"),
      suppressedOverride: z
        .boolean()
        .describe("True if suppression was checked and user is NOT suppressed"),
    }),
    execute: async (input) => ({
      committed: true,
      ...input,
    }),
  }),
};

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { trigger, userContext } = await req.json();

  const result = await generateText({
    model: gateway("anthropic:claude-3-5-haiku-20241022"),
    tools,
    stopWhen: stepCountIs(8),
    system: `You are a lifecycle marketing agent for a developer-focused SaaS product.

Your job is to make smart decisions about how and whether to contact a user after a lifecycle trigger fires.

Follow these steps in order:
1. Call get_user_history to understand prior contact
2. Call check_suppression to verify the user can receive messages (use channel "both")
3. Call score_urgency with relevant signals derived from the trigger and user context
4. Call decide_channel to commit your decision based on what you've learned:
   - If suppressed: use channel "none"
   - If urgency >= 4: use "both"
   - If urgency <= 2: use "in-app" only
   - Otherwise: use your judgment
5. Write the final message copy

Rules:
- Never use the words "journey" or "excited"
- Be direct, specific, and human — not marketing-speak
- Base decisions on the data from the tools, not assumptions

After calling decide_channel, write your final output in EXACTLY this format:

---OUTPUT---
EMAIL_SUBJECT: <subject line>
EMAIL_BODY: <2-3 sentence email body, plain text>
IN_APP: <1 sentence in-app nudge>

If channel is "none", write:
---OUTPUT---
EMAIL_SUBJECT: none
EMAIL_BODY: none
IN_APP: none`,

    prompt: `Trigger: ${trigger}
User context: ${JSON.stringify(userContext)}
User ID: user_001

Work through the tools in order, then write the final output.`,
  });

  // Extract tool trace from steps
  const toolTrace: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = [];

  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      const typedCall = call as unknown as { toolName: string; toolCallId: string; input: Record<string, unknown> };
      const matchingResult = step.toolResults?.find(
        (r: { toolCallId: string }) => r.toolCallId === typedCall.toolCallId
      );
      toolTrace.push({
        toolName: typedCall.toolName,
        args: typedCall.input ?? {},
        result: matchingResult ? (matchingResult as { output: unknown }).output : null,
      });
    }
  }

  // Extract the committed channel decision
  const decisionEntry = toolTrace.find((t) => t.toolName === "decide_channel");
  const decision = decisionEntry?.result as undefined | {
    committed: boolean;
    channel: string;
    reasoning: string;
    urgency: number;
    suppressedOverride: boolean;
  } | null;

  // Parse the structured output from finalText
  const finalText = result.text;
  const outputMatch = finalText.split("---OUTPUT---")[1] ?? "";

  const extractLine = (key: string) => {
    const match = outputMatch.match(new RegExp(`${key}:\\s*(.+)`));
    return match ? match[1].trim() : "";
  };

  const emailSubject = extractLine("EMAIL_SUBJECT");
  const emailBody = extractLine("EMAIL_BODY");
  const inApp = extractLine("IN_APP");

  return Response.json({
    toolTrace,
    decision,
    messages: {
      email: { subject: emailSubject, body: emailBody },
      inApp: { body: inApp },
    },
    steps: result.steps.length,
  });
}
