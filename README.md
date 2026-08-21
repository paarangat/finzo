# Finzo

Local-first personal finance tracking, powered by the AI subscription you already have.

Upload a bank statement (PDF or CSV). Finzo uses your own **Claude Code** or **Codex** CLI to extract every transaction, categorize it, and turn it into a clean monthly dashboard: current balance, total spent, income, category breakdown, and daily spend.

## How it works

- Finzo runs entirely on your machine: a Next.js app with a local SQLite database (`data/finzo.db`).
- When you upload a statement, Finzo shells out to the `claude` or `codex` CLI in headless mode with a strict JSON extraction prompt. Your subscription pays for the tokens; no API keys needed.
- The response is schema-validated (Zod) and written to SQLite atomically. Bad output never corrupts your data.
- Duplicate files are rejected, and identical transactions across overlapping statements are deduplicated.

**Privacy:** your statement never leaves this machine except through your own Claude or Codex subscription, subject to Anthropic's or OpenAI's terms respectively.

## Quickstart

You need Node.js 20+ and at least one AI CLI signed in with your subscription:

```bash
npm install -g @anthropic-ai/claude-code   # then: claude (sign in)
# or
npm install -g @openai/codex               # then: codex (sign in)
```

Then:

```bash
git clone https://github.com/paarangat/finzo.git
cd finzo
npm install
npm run dev
```

Open http://localhost:3000 and drop in a statement.

No subscription? Pick the **Fixture (demo)** engine in the top bar to explore with sample data.

## Configuration

- **Engine**: switch between Claude Code and Codex in the top bar (or set `FINZO_ENGINE=claude|codex|fixture`).
- **Balance**: taken from the statement's closing balance automatically; click the balance stat to enter it manually. The fresher of the two wins.
- **Categories**: a fixed set (Food & Dining, Groceries, Transport, ...). Re-categorize any transaction inline in the table.

## Development

```bash
npm test        # unit tests (schema, store, summary math) — no AI needed
npm run build
```

The fixture engine (`lib/engines/fixture.ts`) lets you develop and test the whole flow without an AI subscription.

## Contributing

Adding a new engine is one file: implement the `Engine` interface in `lib/engines/` (spawn your CLI, return validated JSON) and register it in `lib/engines/index.ts`.

## License

MIT
