import type { Interval } from '../types'

export interface TradeHorizon {
    /** Trading style implied by the timeframe. */
    style: 'Scalp' | 'Intraday' | 'Swing'
    /** Human-readable expected hold window for a trade on this timeframe. */
    hold: string
    /** Duration of one candle in milliseconds. */
    candleMs: number
    /** Roughly how many candles the setup is expected to play out over. */
    validCandles: number
}

const MINUTE = 60_000

// Expected hold ≈ a few candles of the entry timeframe — a 1m setup resolves in
// minutes, a 4h setup over the better part of a day.
export const HORIZONS: Record<Interval, TradeHorizon> = {
    '1m': { style: 'Scalp', hold: '3–5 min', candleMs: MINUTE, validCandles: 5 },
    '5m': { style: 'Scalp', hold: '15–30 min', candleMs: 5 * MINUTE, validCandles: 5 },
    '15m': { style: 'Intraday', hold: '45–90 min', candleMs: 15 * MINUTE, validCandles: 5 },
    '1h': { style: 'Intraday', hold: '3–6 hr', candleMs: 60 * MINUTE, validCandles: 5 },
    '4h': { style: 'Swing', hold: '12–24 hr', candleMs: 240 * MINUTE, validCandles: 4 }
}

export const getHorizon = (interval: Interval): TradeHorizon => HORIZONS[interval]

/** Format a millisecond remainder as `m:ss` (or `h:mm:ss` past an hour). */
export const formatCountdown = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
