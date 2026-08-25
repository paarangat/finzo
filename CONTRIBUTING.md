# Contributing to Finzo

Thanks for looking. Finzo is small on purpose — six runtime dependencies, no state library, no component library — and the goal is to keep it that way. Before adding an abstraction, check whether the thing you need already exists a few files over.

## Ground rule: never commit real financial data

`data/` is gitignored for a reason. It holds your actual bank statements and a database full of your actual transactions. Before opening an issue or a PR:

- **Redact** amounts, merchant names, account numbers, and phone numbers from anything you paste. Real UPI descriptions contain other people's names.
- Don't attach a real statement or CAS PDF. Use `lib/engines/fixture.ts` or demo mode to reproduce.
- Don't zip or copy your working directory to share it — `data/`, `.next/`, and any browser-automation output can all contain rendered financial data.

## Getting set up

```bash
npm install
npm run dev
```

No AI subscription needed to develop: pick the **Fixture (demo)** engine in the top bar, or run with `FINZO_ENGINE=fixture`. The fixture engine returns a canned extraction, so the entire upload → validate → store → render path works offline.

```bash
npm test         # vitest — schema, store, summary math, rules
npm run lint
npm run build
```

All three run in CI on Node 20 and 22.

## How the app is put together

**Next.js 16 App Router, React Server Components, SQLite. There is no API layer between the page and the database.**

- Every page is `export const dynamic = "force-dynamic"` and reads SQLite **synchronously** in the server component via `getDb()`, then passes plain props down.
- `"use client"` components are leaves. They hold local `useState`, mutate through a `fetch()` to a route handler under `app/api/`, then call `router.refresh()` to re-pull server data.
- **There is no client state library and no data-fetching library** — no zustand, no context, no SWR. That's deliberate. `router.refresh()` is the invalidation story.
- `components/auto-refresh.tsx` polls `/api/status` every 4 seconds for the database's mtime and refreshes when it changes, so a long-running upload lands in the UI on its own.

**`lib/db.ts` is the whole data layer** (~780 lines). Schema is created inline with `CREATE TABLE IF NOT EXISTS`, followed by inline migrations. No ORM, no migration tool. Tables: `accounts`, `transactions`, `statements`, `rules`, `budgets`, `recurring_overrides`, `investments`, and a `settings` key/value table.

**Money is stored as integer minor units, always positive**, with a separate `direction` column (`debit` / `credit`). Never store a float, never store a negative. `toMinor()` converts at the boundary; `lib/format.ts` formats for display. Currency formats numbers — Finzo never converts between currencies.

**Settings** are a flat KV table. Read with `db.getSetting(key)`, write with `db.setSetting(key, value)`. Typed accessors (`db.salary()`, `db.age()`) exist only where a conversion is involved. Adding a setting is one line in the Zod `Body` in `app/api/settings/route.ts` and one line in its `PUT`.

## Adding an engine

One file. Implement the `Engine` interface from `lib/engines/types.ts`:

```ts
export interface Engine {
  id: EngineId;
  label: string;
  extract(filePath: string, feedback?: string): Promise<Extraction>;
  run(prompt: string, workDir: string): Promise<string>;
}
```

Spawn your CLI in headless, read-only, sandboxed mode with the prompt from `lib/engines/prompt.ts`, pull the JSON out with `parseModelJson()`, and hand it to `validateExtraction()` — never trust model output into the database. Then add your id to `EngineId` in `types.ts` and register it in `ENGINES` in `lib/engines/index.ts`. `lib/engines/claude.ts` is the shortest example.

`extractWithRetry()` gives you one free retry with the previous error fed back to the model, so `extract()` can fail loudly rather than guessing.

## Adding a category

Add it to `CATEGORIES` in `lib/categories.ts`. That array is the source of truth: it drives the Zod enum in `lib/schema.ts`, the extraction prompt, and the chart palette in `lib/colors.ts` (which needs a matching entry). Decide whether it belongs in `NON_SPEND_CATEGORIES` (money moving, not spending) or `NEEDS_CATEGORIES` (the 50/30/20 split).

Existing rows keep their old category — categories aren't migrated.

## Style

- **Tailwind v4, CSS-first.** There is no `tailwind.config`. Theme tokens live in `app/globals.css` as CSS custom properties surfaced through `@theme inline`. Use `bg-accent-solid` / `text-foreground` rather than hardcoding emerald.
- **Dark mode is `prefers-color-scheme` only** — no `dark` class, no toggle, no `next-themes`. Write `dark:` pairs by hand.
- Zinc neutrals, emerald accent, `rounded-lg` / `rounded-xl`, `text-sm` / `text-xs`, hairline `border-t` section dividers, and `font-mono tabular-nums` on **every** number.
- Comments explain *why*, not *what*, and are worth writing when a decision looks arbitrary. See the note above `showSparkline` in `app/page.tsx` for the tone.

## Tests

`vitest`, no framework beyond it, no fixtures directory. `createDb(":memory:")` gives you a real database per test. Cover the money math, the parsing, and the dedup logic; don't unit-test JSX.

## A note on `AGENTS.md` and `CLAUDE.md`

Both are auto-generated by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) and are instructions for AI coding agents, not project documentation. Ignore them; don't delete them, because `next dev` puts them back.
