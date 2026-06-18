---
name: add-strategy
description: Add a new trading strategy to the Multi-Strategy platform end-to-end — strategy core logic, new indicators, type + registry + signal dispatch, bilingual (EN/ES) explanation, illustrated sample chart, and backtest/live-switch wiring. Use whenever the user asks to add, create, scaffold, or implement a new trading strategy.
---

# Add a trading strategy

This project is a **multi-strategy** futures-signal dashboard. Each strategy is a pure
function returning a `StrategyResult`; everything else (backtest, live switch, card UI,
notifications, optimizer) is shared and picks it up automatically once it's registered.

Do **all** of the steps below, then `pnpm build` to verify. Follow `CLAUDE.md`:
4-space indent, single quotes, no semicolons, arrow-functions assigned to `const`, pnpm.

## The contract

A strategy is `(<id>Result)(ind: Indicators, candles: Candle[], params: StrategyParams) => StrategyResult`.

`StrategyResult` (see `src/strategies/types.ts`):
`{ kind: 'LONG'|'SHORT'|'WAIT', confidence (0–95), reasons: SignalReason[], pattern, fake, entry, stopLoss, takeProfit, riskReward, planBasis }`

- Use `planFromAnchor(ind, kind, anchor, params.stopCushionAtr, 'label')` from `./plan` to
  build entry/stop/target from an invalidation price (structural targets, no canned R:R).
- Use `waitResult('helpful reason')` from `./plan` for the no-setup case (surface the nearest miss).
- `reasons`: each `{ label, direction: 'bull'|'bear'|'neutral', weight }`. Neutral reasons show only on WAIT.
- Apply a **freshness** gate (only fire on a *recent* trigger — last ~1–2 bars), mirroring the
  existing strategies. The generic **reward:risk floor** is applied centrally in `signal.ts` (don't re-add it).
- `confidence`: clamp to 0–95.

`Indicators` already provides: price, ema10/22/55, rsi, rsiSeries, macd, macdHist, atr,
ema10Slope, support, resistance, levels, smartMoney {bias, breakOfStructure, orderBlock, volumeRatio}, trend.
Need something else (ADX, Keltner, Stochastic, …)? Add an indicator file under `src/indicators/`
and compute it from `candles` inside the strategy (see `adx.ts`, `stochastic.ts`).

## Steps (checklist)

1. **Core logic** — `src/indicators/<id>.ts` exporting `<id>Result(...)`. Add any new indicator helper
   in the same file or its own `src/indicators/<thing>.ts`. Model on `bollinger.ts`, `supertrend.ts`,
   `stochastic.ts`, `smc.ts`.

2. **Type** — add `'<id>'` to the `StrategyKind` union in `src/strategies/types.ts`.

3. **Registry** — add `{ id: '<id>', available: true, bullets: 5 }` to `STRATEGIES` in
   `src/strategies/registry.ts` (array order = picker order). `getActiveStrategy` validates against
   this list automatically — no other change there.

4. **Dispatch** — in `src/indicators/signal.ts`, import `<id>Result` and add a
   `case '<id>': return <id>Result(ind, candles, params)` to the `switch` in `strategyResult`.

5. **i18n (BOTH `en` and `es` blocks)** in `src/i18n/translations.ts` — add:
   `strategy.<id>.name`, `.tagline`, `.intro`, and `.b1`…`.bN` where N === the `bullets` count.
   Use `<b>…</b>` for emphasis; escape literal `<`/`>` as `&lt;`/`&gt;`. Keep parity between languages.

6. **Illustrated sample chart** — `src/components/<Name>Sample/<Name>Sample.tsx`:
   - `import { mulberry32, toBars, Candles, type Bar } from '../SampleChart/sampleKit'` and
     `import '../SampleChart/SampleChart.scss'`.
   - Build **deterministic** synthetic candles (`mulberry32(seed)` → closes → `toBars`) that clearly
     show the setup; compute the strategy's real overlay from them (EMA/bands/channel/oscillator).
   - Render a price pane (+ optional indicator pane), the overlay, an Entry + Target dashed `Line`,
     a gold entry circle, the `R:R` label, and the `Now` price guide. Copy the structure from an
     existing `*Sample.tsx` (single-pane: `BollingerSample`; two-pane: `TradingLatinoSample`,
     `StochasticSample`).
   - Register it in the `SAMPLE` map in `src/components/StrategyInfoModal/StrategyInfoModal.tsx`.
     **This map is a full `Record<StrategyKind, …>` — every id must have an entry or the build fails.**

7. **Build & verify** — `pnpm build` (runs `tsc -b && vite build`). Then sanity-check in the app:
   the picker lists it, the ⓘ modal shows chart + bullets, "How it works" follows it, and the card
   shows live signals + a backtest verdict.

8. **Update the README** — a new strategy changes the count and the strategies table. Apply the
   `update-readme` skill so `README.md` stays in sync (strategy count, tagline, strategies table).

## What is automatic (do NOT wire by hand)

- **Backtesting / verdict / optimizer** — `runBacktest`/`runBacktestOn` call `buildSignal`, which
  dispatches to the active strategy. The strategy reuses the shared `StrategyParams`.
- **Live switching** — `ActiveStrategyContext` + the card's effects recompute signal and verdict in
  place when the strategy changes (no reload).
- **Notifications, card UI, pattern label** — all read the `Signal`. The card falls back to the raw
  `pattern` string for unknown patterns, so no PATTERN_KEY change is needed.

## Gotchas

- `SAMPLE` map and `STRATEGIES` and the `switch` must all include the new id, or you'll get a
  TS error / a strategy that silently never fires.
- i18n missing in one language renders the raw key — add to both blocks.
- Keep synthetic sample data deterministic (seeded RNG) so the chart never flickers between renders.
- Storage key for the active strategy is `v-bounce-active-strategy` (kept from the original name).
