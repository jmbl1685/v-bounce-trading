---
name: add-indicator
description: Add a technical-analysis indicator (RSI/EMA/ATR/ADX/Stochastic-style) to src/indicators/. Use when implementing a new indicator, whether it feeds the shared analyze() snapshot or is used privately by one strategy. Pairs with the add-strategy skill.
---

# Add an indicator

Indicators are **pure functions** over candles/values in `src/indicators/`. There are two paths —
pick based on who needs the value.

## Path A — private to a strategy (most common)

If only one strategy needs it, just create `src/indicators/<name>.ts` and call it from the
strategy. No type/pipeline changes. Examples: `adx.ts` (DMI/ADX), `stochastic.ts`, the Keltner/
squeeze math inside `tradinglatino.ts`.

```ts
import type { Candle } from '../types'

export interface Dmi { diPlus: number; diMinus: number; adx: number }

export const dmi = (candles: Candle[], period = 14): Dmi | null => {
    if (candles.length <= period * 2) return null
    // …Wilder-smoothed computation…
}
```

## Path B — part of the shared Indicators snapshot

If many strategies / the card UI need it on every tick:

1. Add the field to the `Indicators` interface in `src/types/index.ts`.
2. Compute it in `analyze()` in `src/indicators/analyze.ts` and include it in the returned object.
3. Export the helper from your `src/indicators/<name>.ts`.

It then flows into `useAssetStream`, the card, notifications, and the backtest automatically.

## Conventions (match the existing helpers)

- Provide a **latest-value** function and, when a series is needed for shape/cross detection, a
  **`<name>Series()`** returning the full array (see `ema.ts`, `rsi.ts`, `macd.ts`).
- **Wilder smoothing** for the ATR/RSI/ADX family: seed with the SMA of the first `period` values,
  then `value = (value * (period - 1) + next) / period` across the remainder (see `atr.ts`, `adx.ts`).
- **EMA** seeding uses the SMA of the first `period` values, then the standard `k = 2/(period+1)`
  recurrence (see `ema.ts`).
- **Guard insufficient data** — return `NaN` (scalars) or `null` (objects) and have callers handle it.
- Single quotes, no semicolons, arrow `const`s, 4-space indent.

## Verify

`pnpm build`. If Path B, confirm the new field appears on `Indicators` and is consumed where intended.
