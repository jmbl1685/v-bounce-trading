---
name: update-readme
description: Keep README.md in sync with the codebase. Use after any change that the README documents — adding/removing a strategy, a major feature, a rename, a stack/deploy change — or whenever the README looks stale. Knows which README sections track which sources of truth.
---

# Keep the README updated

`README.md` is the project's front door and drifts easily. Treat it as **generated from the code**:
after a change that it describes, reconcile it. This is a multi-strategy platform — the README must
reflect *all* strategies, not just the original V-Bounce.

## Sources of truth → README sections

| README section | Source of truth |
| --- | --- |
| Title + tagline (top) | Branding: `src/components/Header/Header.tsx` (`<h1>`), `index.html` `<title>`, `package.json` `name`. App is **Multi-Strategy**. |
| Strategy list / count | `src/strategies/registry.ts` (`STRATEGIES`) + their names in `src/i18n/translations.ts` (`strategy.<id>.name` / `.tagline`). |
| "The strategies" section | Each strategy's `intro` + bullets in `translations.ts`, and its `*.ts` logic in `src/indicators/`. |
| ✨ Features | Major capabilities (multi-strategy selector, backtesting/optimize, paper + real trading, display-currency, PnL history, notifications, themes, EN/ES, rate-limit breaker). |
| Getting started / scripts | `package.json` `scripts`. |
| Deployment | `pnpm run deploy`, Vercel, the live `*.vercel.app` URL. |
| Tech stack | `package.json` dependencies (React/TS/Vite/Sass versions). |

## When to update (triggers)

- **Added/removed a strategy** → update the strategy count everywhere, the strategy list/table, and
  the tagline (e.g. "8 switchable strategies"). This is the most common drift — pair it with the
  `add-strategy` skill.
- **Added a major feature** → add a bullet to ✨ Features.
- **Renamed the app / changed the live URL** → fix the title, tagline, and deploy links.
- **Changed scripts / stack / deps** → fix Getting started and Tech stack.

## How to do it

1. Read `README.md` and the relevant source of truth above.
2. Make the README match — prefer concise, accurate bullets over marketing fluff. Keep the existing
   voice, emojis, badges, and the bottom credit block (`*Under Juan Batty technical instructions | 0
   human codification*`).
3. For the strategy section, since there are now many strategies, prefer a **compact table** (one row
   per strategy: name + one-line idea) over a deep dive on a single one. Derive the rows from
   `STRATEGIES` order and each `strategy.<id>.tagline`.
4. Keep numbers honest — count `STRATEGIES` entries; don't guess.
5. README-only change → no `pnpm build` needed, but it's safe to run. Commit with `[DOCS]: …`.

## Current known drift (fix when you run this)

The README still describes only **V-Bounce** as "the strategy" and pre-dates the multi-strategy
rename. Bring it up to date: new title/tagline, a Strategies table covering all `STRATEGIES`, and a
Features bullet for the strategy selector + the newer panels (display currency, PnL history).
