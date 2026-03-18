# Activation Agent

A lifecycle marketing agent that detects key activation events and generates personalized follow-up sequences — email + in-app — using Claude via the Vercel AI SDK.

Built with Next.js, deployed on Vercel.

## How it works

1. Select an activation trigger (e.g. "User created first project but hasn't deployed")
2. The agent receives the trigger + user context
3. Claude generates a targeted email subject/body, in-app nudge, and reasoning

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Vercel AI SDK](https://sdk.vercel.ai) — `generateObject` with structured output
- [Anthropic Claude](https://anthropic.com) — claude-3-5-haiku-20241022
- [Zod](https://zod.dev) — schema validation

## Local setup

```bash
npm install
```

Add your Anthropic API key:

```bash
# .env.local
ANTHROPIC_API_KEY=your_key_here
```

```bash
npm run dev
```

## Deploy

Deploy to Vercel and add `ANTHROPIC_API_KEY` as an environment variable in your project settings.
