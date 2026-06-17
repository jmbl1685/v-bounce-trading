/**
 * Exponential Moving Average over a series of values.
 * Returns the full EMA series (same length as input, leading values seeded by SMA).
 */
export const emaSeries = (values: number[], period: number): number[] => {
    if (values.length === 0) return []

    const k = 2 / (period + 1)
    const out: number[] = []

    // Seed with a simple moving average of the first `period` values.
    const seedCount = Math.min(period, values.length)
    let seed = 0
    for (let i = 0; i < seedCount; i++) seed += values[i]
    seed /= seedCount

    let prev = seed
    for (let i = 0; i < values.length; i++) {
        if (i < seedCount - 1) {
            out.push(seed)
            continue
        }
        if (i === seedCount - 1) {
            out.push(seed)
            prev = seed
            continue
        }
        const next = values[i] * k + prev * (1 - k)
        out.push(next)
        prev = next
    }

    return out
}

/** Latest EMA value, or NaN when there is not enough data. */
export const ema = (values: number[], period: number): number => {
    const series = emaSeries(values, period)
    return series.length ? series[series.length - 1] : NaN
}
