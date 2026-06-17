/**
 * Wilder's RSI as a full series aligned to `closes` (NaN until enough data).
 * The series is what lets us detect the V (valley) shape, not just a point.
 */
export const rsiSeries = (closes: number[], period = 14): number[] => {
    const out: number[] = new Array(closes.length).fill(NaN)
    if (closes.length <= period) return out

    let gain = 0
    let loss = 0
    for (let i = 1; i <= period; i++) {
        const delta = closes[i] - closes[i - 1]
        if (delta >= 0) gain += delta
        else loss -= delta
    }
    let avgGain = gain / period
    let avgLoss = loss / period
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

    for (let i = period + 1; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1]
        const up = delta > 0 ? delta : 0
        const down = delta < 0 ? -delta : 0
        avgGain = (avgGain * (period - 1) + up) / period
        avgLoss = (avgLoss * (period - 1) + down) / period
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    }

    return out
}

/** Latest RSI value (0-100), or NaN when there is not enough data. */
export const rsi = (closes: number[], period = 14): number => {
    const series = rsiSeries(closes, period)
    const last = series[series.length - 1]
    return last === undefined ? NaN : last
}
