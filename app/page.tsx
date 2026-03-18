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

type Output = {
  email: { subject: string; body: string };
  inApp: { body: string };
  reasoning: string;
};

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
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
      setError("Something went wrong. Check your ANTHROPIC_API_KEY.");
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
            Select a trigger, run the agent, and get a personalized activation sequence.
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
          {loading ? "Generating…" : "Run agent →"}
        </button>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-red-400 mb-6">{error}</p>
        )}

        {/* Output */}
        {output && (
          <section className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium">
              Output
            </p>

            {/* Reasoning */}
            <div className="border border-[#1a1a1a] rounded-md px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium mb-1.5">
                Reasoning
              </p>
              <p className="text-[13px] text-[#777] leading-[1.6]">{output.reasoning}</p>
            </div>

            {/* Email */}
            <div className="border border-[#1a1a1a] rounded-md px-4 py-3 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium">
                Email
              </p>
              <p className="text-[13px] font-medium text-white">{output.email.subject}</p>
              <p className="text-[13px] text-[#777] leading-[1.6]">{output.email.body}</p>
            </div>

            {/* In-app */}
            <div className="border border-[#1a1a1a] rounded-md px-4 py-3 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#444] font-medium">
                In-app nudge
              </p>
              <p className="text-[13px] text-[#777] leading-[1.6]">{output.inApp.body}</p>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
