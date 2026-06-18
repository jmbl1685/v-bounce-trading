import type { Candle, Indicators, SignalReason } from '../types'
import type { StrategyParams } from './params'
import type { StrategyResult } from '../strategies/types'
import { planFromAnchor, waitResult } from './plan'

const PERIOD = 14
const SMOOTH_K = 3
const SMOOTH_D = 3
const OVERSOLD = 25
const OVERBOUGHT = 75
const SWING = 6

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const sma = (a: number[], end: number, len: number) => {
    let s = 0
    for (let i = end - len + 1; i <= end; i++) s += a[i]
    return s / len
}

export interface Stoch {
    k: number
    d: number
    kPrev: number
    dPrev: number
}

/** Stochastic %K / %D (slow), with the prior values for cross detection. */
export const stochastic = (candles: Candle[]): Stoch | null => {
    const n = candles.length
    if (n < PERIOD + SMOOTH_K + SMOOTH_D) return null

    const rawK: number[] = []
    for (let i = PERIOD - 1; i < n; i++) {
        const win = candles.slice(i - PERIOD + 1, i + 1)
        const hh = Math.max(...win.map((c) => c.high))
        const ll = Math.min(...win.map((c) => c.low))
        rawK.push(hh - ll > 0 ? (100 * (candles[i].close - ll)) / (hh - ll) : 50)
    }
    const slowK: number[] = []
    for (let i = SMOOTH_K - 1; i < rawK.length; i++) slowK.push(sma(rawK, i, SMOOTH_K))
    const dArr: number[] = []
    for (let i = SMOOTH_D - 1; i < slowK.length; i++) dArr.push(sma(slowK, i, SMOOTH_D))
    if (slowK.length < 2 || dArr.length < 2) return null

    return {
        k: slowK[slowK.length - 1],
        kPrev: slowK[slowK.length - 2],
        d: dArr[dArr.length - 1],
        dPrev: dArr[dArr.length - 2]
    }
}

/**
 * Stochastic — a pullback-timing oscillator used with the trend. In an uptrend,
 * a %K/%D cross up out of oversold times the dip (LONG); the mirror in a
 * downtrend is a SHORT. The trend filter keeps it from fading strong moves.
 */
export const stochasticResult = (ind: Indicators, candles: Candle[], params: StrategyParams): StrategyResult => {
    const s = stochastic(candles)
    if (!s) return waitResult('Not enough data for Stochastic')

    const upTrend = ind.price > ind.ema55 && ind.ema10 > ind.ema22
    const downTrend = ind.price < ind.ema55 && ind.ema10 < ind.ema22
    const bullCross = s.kPrev <= s.dPrev && s.k > s.d && Math.min(s.kPrev, s.dPrev) <= OVERSOLD
    const bearCross = s.kPrev >= s.dPrev && s.k < s.d && Math.max(s.kPrev, s.dPrev) >= OVERBOUGHT

    if (upTrend && bullCross) {
        const swingLow = Math.min(...candles.slice(-SWING).map((c) => c.low))
        const plan = planFromAnchor(ind, 'LONG', swingLow, params.stopCushionAtr, 'swing low')
        const reasons: SignalReason[] = [
            { label: 'Uptrend — price above the 55-EMA, EMAs aligned', direction: 'bull', weight: 3 },
            { label: `%K crossed above %D out of oversold (${s.k.toFixed(0)})`, direction: 'bull', weight: 3 }
        ]
        const confidence = clamp(56 + clamp((OVERSOLD - Math.min(s.kPrev, s.dPrev)) * 0.7, 0, 16) + clamp(ind.ema10Slope * 24, 0, 10), 0, 92)
        return { kind: 'LONG', confidence: Math.round(confidence), reasons, pattern: 'Stochastic cross (long)', fake: false, ...plan }
    }

    if (downTrend && bearCross) {
        const swingHigh = Math.max(...candles.slice(-SWING).map((c) => c.high))
        const plan = planFromAnchor(ind, 'SHORT', swingHigh, params.stopCushionAtr, 'swing high')
        const reasons: SignalReason[] = [
            { label: 'Downtrend — price below the 55-EMA, EMAs aligned', direction: 'bear', weight: 3 },
            { label: `%K crossed below %D out of overbought (${s.k.toFixed(0)})`, direction: 'bear', weight: 3 }
        ]
        const confidence = clamp(56 + clamp((Math.max(s.kPrev, s.dPrev) - OVERBOUGHT) * 0.7, 0, 16) + clamp(-ind.ema10Slope * 24, 0, 10), 0, 92)
        return { kind: 'SHORT', confidence: Math.round(confidence), reasons, pattern: 'Stochastic cross (short)', fake: false, ...plan }
    }

    if (upTrend) return waitResult('Uptrend — waiting for a Stochastic cross out of oversold')
    if (downTrend) return waitResult('Downtrend — waiting for a Stochastic cross out of overbought')
    return waitResult('No clean trend for a Stochastic pullback')
}
