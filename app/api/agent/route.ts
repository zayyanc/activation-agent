import { createGateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";

const gateway = createGateway();
import { z } from "zod";

const outputSchema = z.object({
  email: z.object({
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body, 2-3 sentences max, plain text"),
  }),
  inApp: z.object({
    body: z.string().describe("Short in-app nudge, 1 sentence"),
  }),
  reasoning: z.string().describe("1-sentence explanation of why this message fits the trigger"),
});

export async function POST(req: Request) {
  const { trigger, userContext } = await req.json();

  const { object } = await generateObject({
    model: gateway("anthropic:claude-3-5-haiku-20241022"),
    schema: outputSchema,
    system: `You are a lifecycle marketing agent for a developer-focused SaaS product.
Your job is to generate precise, human-feeling activation messages — not marketing fluff.
Be direct, helpful, and specific to the trigger. Never use the word "journey" or "excited".`,
    prompt: `Trigger: ${trigger}
User context: ${JSON.stringify(userContext)}

Generate a personalized activation sequence for this user.`,
  });

  return Response.json(object);
}
