import type { Candle } from '../types'

/**
 * Average True Range (Wilder). A volatility measure in absolute price units —
 * used to size stop buffers and target projections so they adapt to how much
 * the asset is actually moving rather than a fixed percentage.
 */
export const atr = (candles: Candle[], period = 14): number => {
    if (candles.length <= period) return NaN

    const trueRanges: number[] = []
    for (let i = 1; i < candles.length; i++) {
        const c = candles[i]
        const prev = candles[i - 1]
        const tr = Math.max(
            c.high - c.low,
            Math.abs(c.high - prev.close),
            Math.abs(c.low - prev.close)
        )
        trueRanges.push(tr)
    }

    // Seed with the simple average of the first `period` true ranges.
    let sum = 0
    for (let i = 0; i < period; i++) sum += trueRanges[i]
    let value = sum / period

    // Wilder smoothing across the remainder.
    for (let i = period; i < trueRanges.length; i++) {
        value = (value * (period - 1) + trueRanges[i]) / period
    }

    return value
}
