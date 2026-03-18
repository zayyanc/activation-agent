"use client";

import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const EXAMPLE_TRIGGERS = [
  {
    label: "First project, no deploy after 3 days",
    trigger: "User created first project but has not deployed after 3 days",
    userContext: {
      plan: "free",
      daysActive: 3,
      projectsCreated: 1,
      deploymentsCount: 0,
    },
  },
  {
    label: "Hit free plan rate limit twice this week",
    trigger: "User hit the free plan rate limit for the second time this week",
    userContext: {
      plan: "free",
      daysActive: 14,
      apiCallsThisWeek: 500,
      rateLimitHits: 2,
    },
  },
  {
    label: "Added a second seat for the first time",
    trigger: "User added a second seat to their workspace for the first time",
    userContext: {
      plan: "pro",
      daysActive: 7,
      teamSize: 2,
      deploymentsCount: 5,
    },
  },
];

type ToolTraceEntry = {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
};

type ChannelDecision = {
  channel: "email" | "in-app" | "both" | "none";
  reasoning: string;
  urgency: number;
};

type AgentOutput = {
  toolTrace: ToolTraceEntry[];
  decision: ChannelDecision | null;
  messages: {
    email: { subject: string; body: string };
    inApp: { body: string };
  };
  steps: number;
};

const TOOL_LABELS: Record<string, string> = {
  get_user_history: "Checked message history",
  check_suppression: "Checked suppression status",
  score_urgency: "Scored urgency",
  decide_channel: "Committed channel decision",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-[#0d2235] text-[#4da6ff]",
  "in-app": "bg-[#1a1a0d] text-[#b3a020]",
  both: "bg-[#0d2e1a] text-[#3dd68c]",
  none: "bg-[#1a1a1a] text-[#555]",
};

function UrgencyDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= score ? "bg-white" : "bg-[#333]"
          }`}
        />
      ))}
      <span className="text-[11px] text-[#555] ml-1">{score}/5</span>
    </div>
  );
}

function ToolTraceItem({ entry }: { entry: ToolTraceEntry }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[entry.toolName] ?? entry.toolName;

  return (
    <div className="border border-[#1a1a1a] rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#111] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-[#3dd68c]">fn</span>
          <span className="text-[12px] text-[#999]">{label}</span>
          <span className="text-[11px] font-mono text-[#444]">{entry.toolName}</span>
        </div>
        <span className="text-[11px] text-[#444]">{open ? "↑" : "↓"}</span>
      </button>
      {open && (
        <div className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#444] mb-1">Input</p>
            <pre
              className="text-[11px] text-[#555] overflow-x-auto"
              style={{ fontFamily: geistMono.style.fontFamily }}
            >
              {JSON.stringify(entry.args, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#444] mb-1">Output</p>
            <pre
              className="text-[11px] text-[#555] overflow-x-auto"
              style={{ fontFamily: geistMono.style.fontFamily }}
            >
              {JSON.stringify(entry.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setOutput(null);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(EXAMPLE_TRIGGERS[selected]),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setOutput(data);
    } catch {
      setError("Something went wrong. Check the Vercel logs.");
    } finally {
      setLoading(false);
    }
  };

  const current = EXAMPLE_TRIGGERS[selected];

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#ededed]"
      style={{ fontFamily: geist.style.fontFamily }}
    >
      <div className="max-w-[620px] mx-auto px-6 py-12">

        {/* Header */}
        <header className="mb-10">
          <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-[#444] mb-2">
            Activation Agent
          </p>
          <h1 className="text-[20px] font-medium tracking-[-0.01em] text-white">
            Lifecycle message generator
          </h1>
          <p className="mt-1.5 text-[13px] text-[#666] leading-[1.6]">
            The agent checks message history, suppression status, and urgency before deciding how to reach the user.
          </p>
        </header>

        {/* Trigger selector */}
        <section className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium mb-3">
            Trigger
          </p>
          <div className="space-y-2">
            {EXAMPLE_TRIGGERS.map((t, i) => (
              <button
                key={i}
                onClick={() => { setSelected(i); setOutput(null); }}
                className={`w-full text-left px-4 py-3 rounded-md border text-[13px] transition-colors ${
                  selected === i
                    ? "border-[#333] bg-[#111] text-white"
                    : "border-[#1a1a1a] bg-transparent text-[#666] hover:text-[#999] hover:border-[#2a2a2a]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Context preview */}
        <section className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium mb-2">
            User context
          </p>
          <pre
            className="text-[12px] text-[#555] bg-[#0d0d0d] border border-[#1a1a1a] rounded-md px-4 py-3 overflow-x-auto"
            style={{ fontFamily: geistMono.style.fontFamily }}
          >
            {JSON.stringify(current.userContext, null, 2)}
          </pre>
        </section>

        {/* Run button */}
        <button
          onClick={run}
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-white text-black text-[13px] font-medium hover:bg-[#e0e0e0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-8"
        >
          {loading ? "Agent running…" : "Run agent →"}
        </button>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-red-400 mb-6">{error}</p>
        )}

        {/* Output */}
        {output && (
          <div className="space-y-8">

            {/* Agent trace */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium">
                  Agent trace
                </p>
                <span className="text-[11px] text-[#333]">{output.steps} steps</span>
              </div>
              <div className="space-y-1.5">
                {output.toolTrace.map((entry, i) => (
                  <ToolTraceItem key={i} entry={entry} />
                ))}
              </div>
            </section>

            {/* Decision */}
            {output.decision && (
              <section>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium mb-3">
                  Decision
                </p>
                <div className="border border-[#1a1a1a] rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded tracking-wider uppercase ${CHANNEL_COLORS[output.decision.channel] ?? "bg-[#1a1a1a] text-[#555]"}`}>
                      {output.decision.channel}
                    </span>
                    <UrgencyDots score={output.decision.urgency} />
                  </div>
                  <p className="text-[13px] text-[#777] leading-[1.6]">{output.decision.reasoning}</p>
                </div>
              </section>
            )}

            {/* Messages */}
            {output.decision?.channel !== "none" && (
              <section>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium mb-3">
                  Messages
                </p>
                <div className="space-y-3">
                  {(output.decision?.channel === "email" || output.decision?.channel === "both") && output.messages.email.subject !== "none" && (
                    <div className="border border-[#1a1a1a] rounded-md p-4 space-y-2">
                      <span className="text-[11px] font-medium text-[#555] uppercase tracking-[0.08em]">Email</span>
                      <p className="text-[13px] font-medium text-white">{output.messages.email.subject}</p>
                      <p className="text-[13px] text-[#777] leading-[1.6]">{output.messages.email.body}</p>
                    </div>
                  )}
                  {(output.decision?.channel === "in-app" || output.decision?.channel === "both") && output.messages.inApp.body !== "none" && (
                    <div className="border border-[#1a1a1a] rounded-md p-4 space-y-2">
                      <span className="text-[11px] font-medium text-[#555] uppercase tracking-[0.08em]">In-app nudge</span>
                      <p className="text-[13px] text-[#777] leading-[1.6]">{output.messages.inApp.body}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
