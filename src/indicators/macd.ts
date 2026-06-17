import { emaSeries } from './ema'
import type { MacdPoint } from '../types'

/**
 * Moving Average Convergence Divergence.
 * Default 12/26/9 configuration. Returns the latest MACD point.
 */
export const macd = (
    closes: number[],
    fast = 12,
    slow = 26,
    signalPeriod = 9
): MacdPoint => {
    if (closes.length < slow + signalPeriod) {
        return { macd: NaN, signal: NaN, histogram: NaN }
    }

    const fastEma = emaSeries(closes, fast)
    const slowEma = emaSeries(closes, slow)
    const macdLine = closes.map((_, i) => fastEma[i] - slowEma[i])

    const signalLine = emaSeries(macdLine, signalPeriod)
    const lastMacd = macdLine[macdLine.length - 1]
    const lastSignal = signalLine[signalLine.length - 1]

    return {
        macd: lastMacd,
        signal: lastSignal,
        histogram: lastMacd - lastSignal
    }
}

/**
 * The MACD histogram aligned to the candle series, for V-shape detection.
 * Leading bars (before enough data) are NaN so indices match the closes array.
 */
export const macdHistSeries = (
    closes: number[],
    fast = 12,
    slow = 26,
    signalPeriod = 9
): number[] => {
    if (closes.length < slow + signalPeriod) return closes.map(() => NaN)

    const fastEma = emaSeries(closes, fast)
    const slowEma = emaSeries(closes, slow)
    const macdLine = closes.map((_, i) => fastEma[i] - slowEma[i])
    const signalLine = emaSeries(macdLine, signalPeriod)

    return macdLine.map((m, i) => {
        const s = signalLine[i]
        return Number.isFinite(m) && Number.isFinite(s) ? m - s : NaN
    })
}
