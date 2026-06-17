import type { Candle, Indicators, SignalKind, SignalReason } from '../types'
import { DEFAULT_PARAMS, type StrategyParams } from './params'

// --- Fixed structural constants (not user-tunable) ---------------------------
// Window (bars) in which the V / inverted-V must form. A turn should be recent.
const V_WINDOW = 8
// Minimum RSI move on each leg (in RSI points) to count as a real V.
const RSI_MIN_LEG = 3
// Volume vs average that signals conviction behind the current candle.
const VOL_SURGE = 1.3
// A move of this many ATR into the extreme is a strong (powerful) impulse.
const IMPULSE_ATR = 2.0
// A wick of this many ATR is a meaningful rejection candle.
const WICK_ATR = 0.4
// RSI snap-back (points) out of the extreme that counts as a sharp reversal.
const RSI_SNAP = 10
// Each leg of the MACD-histogram V must be at least this fraction of the
// window's histogram amplitude to count as a genuine momentum turn (scale-free).
const MACD_MIN_FRAC = 0.18

type Mode = 'long' | 'short'

interface Extreme {
    isV: boolean
    index: number
    value: number
    leftLeg: number // move into the extreme
    rightLeg: number // move out of the extreme (the turn)
}

const NONE: Extreme = { isV: false, index: -1, value: NaN, leftLeg: 0, rightLeg: 0 }

/** Detect a valley (long) or peak (short) at the end of a series. */
const detectExtreme = (raw: number[], window: number, minLeg: number, mode: Mode): Extreme => {
    const series = raw.slice(-window).filter(Number.isFinite)
    const n = series.length
    if (n < 5) return NONE

    const sign = mode === 'long' ? 1 : -1
    let ei = 0
    for (let i = 1; i < n; i++) if (sign * series[i] < sign * series[ei]) ei = i
    if (ei === 0 || ei === n - 1) return NONE

    const leftLeg = sign * (series[0] - series[ei])
    const rightLeg = sign * (series[n - 1] - series[ei])
    return {
        isV: leftLeg >= minLeg && rightLeg >= minLeg,
        index: raw.length - n + ei,
        value: series[ei],
        leftLeg,
        rightLeg
    }
}

interface Swing {
    beyond: boolean // lower low (long) / higher high (short) vs prior swing
    divergence: boolean // price beyond, but RSI not confirming → exhaustion
}

/** Compare the current extreme to the prior swing to gauge trend exhaustion. */
const priorSwing = (prices: number[], rsiSeries: number[], idx: number, mode: Mode): Swing => {
    const start = Math.max(0, idx - 2 * V_WINDOW)
    const end = idx - 2
    if (end - start < 2) return { beyond: false, divergence: false }

    const sign = mode === 'long' ? 1 : -1
    let pi = start
    for (let i = start + 1; i <= end; i++) if (sign * prices[i] < sign * prices[pi]) pi = i

    const beyond = sign * prices[idx] < sign * prices[pi]
    const divergence = beyond && sign * (rsiSeries[idx] - rsiSeries[pi]) > 0
    return { beyond, divergence }
}

export interface VBounce {
    kind: SignalKind
    confidence: number
    reasons: SignalReason[]
    pattern: string
    fake: boolean
    stopAnchor: number | null
}

interface DirResult extends VBounce {
    noSetup: boolean
    hint: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Evaluate one direction (long V-bounce or short inverted-V) with a power filter. */
const evaluateDirection = (candles: Candle[], ind: Indicators, mode: Mode, p: StrategyParams): DirResult => {
    const { rsiSeries, ema10, ema55, atr, ema10Slope, smartMoney, macdHist } = ind
    const long = mode === 'long'
    const lows = candles.map((c) => c.low)
    const highs = candles.map((c) => c.high)
    const closes = candles.map((c) => c.close)
    const prices = long ? lows : highs

    const wait = (hint: string): DirResult => ({
        kind: 'WAIT', confidence: 0, reasons: [], pattern: 'No setup', fake: false, stopAnchor: null, noSetup: true, hint
    })

    const rsiX = detectExtreme(rsiSeries, V_WINDOW, RSI_MIN_LEG, mode)
    const priceX = detectExtreme(prices, V_WINDOW, p.priceLegAtr * atr, mode)
    const shape = rsiX.isV && priceX.isV

    // MACD histogram V (momentum turn) — a confirmation, not a gate. Each leg
    // must clear a fraction of the window's amplitude, and the trough/peak must
    // sit on the right side of zero (negative for a long, positive for a short).
    const histWin = macdHist.slice(-V_WINDOW).filter(Number.isFinite)
    const histAmp = histWin.length ? Math.max(...histWin.map(Math.abs)) : 0
    const macdX = detectExtreme(macdHist, V_WINDOW, histAmp * MACD_MIN_FRAC, mode)
    const macdV = macdX.isV && (long ? macdX.value < 0 : macdX.value > 0)
    const rsiExtreme = long ? rsiX.value <= p.rsiOversold : rsiX.value >= p.rsiOverbought
    const emaSide = priceX.index >= 0 && (long ? prices[priceX.index] < ema10 : prices[priceX.index] > ema10)

    if (!shape || !rsiExtreme || !emaSide) {
        if (rsiX.isV && !rsiExtreme) {
            return wait(
                long
                    ? `RSI V too shallow (trough ${rsiX.value.toFixed(0)}, need ≤ ${p.rsiOversold})`
                    : `RSI inverted-V too shallow (peak ${rsiX.value.toFixed(0)}, need ≥ ${p.rsiOverbought})`
            )
        }
        return wait('No clean turn yet')
    }

    // --- Trend power vs reversal: exhausted (real) or still driving (fake)? ----
    const swing = priorSwing(prices, rsiSeries, priceX.index, mode)
    const slopePower = long
        ? ema10Slope <= -p.fakeSlope && ema10 < ema55
        : ema10Slope >= p.fakeSlope && ema10 > ema55
    const continuation = swing.beyond && !swing.divergence

    // Rejection wick (hammer at the low / shooting-star at the high) on the
    // turning candle or the latest candle.
    const wickOf = (c: Candle) => {
        const b = long ? Math.min(c.open, c.close) : Math.max(c.open, c.close)
        return (long ? b - c.low : c.high - b) / atr
    }
    const rejection = Math.max(wickOf(candles[priceX.index]), wickOf(candles[candles.length - 1])) >= WICK_ATR

    const volSurge = smartMoney.volumeRatio >= VOL_SURGE
    // A powerful, volume-backed impulse into the extreme with no rejection and no
    // divergence = the trend still has force (the breakout-continuation case).
    const impulsePower = priceX.leftLeg >= IMPULSE_ATR * atr && volSurge && !rejection && !swing.divergence

    // Capitulation: an outsized volume spike inside the V window. Long side only —
    // for shorts a volume spike is buying *power*, not selling exhaustion.
    const vols = candles.map((c) => c.volume)
    const baseSlice = vols.slice(Math.max(0, vols.length - 4 * V_WINDOW), vols.length - V_WINDOW)
    const baseVol = baseSlice.length ? baseSlice.reduce((a, b) => a + b, 0) / baseSlice.length : 0
    const climax = long && baseVol > 0 && Math.max(...vols.slice(-V_WINDOW)) / baseVol >= p.climaxVol

    // Sharp RSI snap-back out of the extreme = momentum reversed hard.
    const sharpReversal = rsiX.rightLeg >= RSI_SNAP

    // A capitulation/blow-off reversal overrides "trend still has power": a
    // divergence alone, or any two independent reversal confirmations (the MACD
    // histogram turning is one of them).
    const confirms = [swing.divergence, rejection, sharpReversal, climax, macdV].filter(Boolean).length
    const reversal = swing.divergence || confirms >= 2

    const fake = (slopePower || continuation || impulsePower) && !reversal

    if (fake) {
        const reasons: SignalReason[] = []
        const against: SignalReason['direction'] = long ? 'bear' : 'bull'
        if (slopePower) {
            reasons.push({
                label: long ? 'EMA10 still falling steeply — downtrend has power' : 'EMA10 rising steeply — uptrend has power',
                direction: against,
                weight: 3
            })
        }
        if (continuation) {
            reasons.push({
                label: long ? 'Lower low with no RSI divergence — sellers in control' : 'Higher high with no RSI divergence — buyers in control',
                direction: against,
                weight: 3
            })
        }
        if (impulsePower) {
            reasons.push({
                label: long ? 'Heavy volume-backed sell impulse — likely a SHORT continuation' : 'Heavy volume-backed breakout — likely a LONG continuation',
                direction: against,
                weight: 3
            })
        }
        return {
            kind: 'WAIT',
            confidence: 0,
            reasons,
            pattern: long ? 'Fake V (downtrend)' : 'Fake Λ (uptrend)',
            fake: true,
            stopAnchor: prices[priceX.index],
            noSetup: false,
            hint: ''
        }
    }

    // --- Valid reversal: grade its strength ----------------------------------
    const reclaim = long ? closes[closes.length - 1] > ema10 : closes[closes.length - 1] < ema10
    const fading = long ? ema10Slope > -p.fakeSlope / 2 : ema10Slope < p.fakeSlope / 2
    const dir: SignalReason['direction'] = long ? 'bull' : 'bear'

    const reasons: SignalReason[] = [
        {
            label: long
                ? `RSI V-bounce from oversold (${rsiX.value.toFixed(0)} → ${ind.rsi.toFixed(0)})`
                : `RSI inverted-V from overbought (${rsiX.value.toFixed(0)} → ${ind.rsi.toFixed(0)})`,
            direction: dir,
            weight: 3
        },
        {
            label: long ? 'Price carved a V below EMA10' : 'Price carved an inverted-V above EMA10',
            direction: dir,
            weight: 2
        }
    ]
    if (macdV) reasons.push({ label: long ? 'MACD histogram carved a V (momentum turning up)' : 'MACD histogram carved an inverted-V (momentum rolling over)', direction: dir, weight: 2 })
    if (swing.divergence) reasons.push({ label: long ? 'Bullish RSI divergence (sellers exhausting)' : 'Bearish RSI divergence (buyers exhausting)', direction: dir, weight: 3 })
    if (climax) reasons.push({ label: 'Capitulation volume climax (selling exhausted)', direction: dir, weight: 3 })
    if (sharpReversal) reasons.push({ label: long ? 'Sharp RSI snap-back off the low' : 'Sharp RSI roll-over off the high', direction: dir, weight: 2 })
    if (rejection) reasons.push({ label: long ? 'Rejection wick off the low' : 'Rejection wick off the high', direction: dir, weight: 2 })
    if (!swing.beyond) reasons.push({ label: long ? 'Higher low vs prior swing' : 'Lower high vs prior swing', direction: dir, weight: 2 })
    if (fading) reasons.push({ label: long ? 'Downtrend losing power' : 'Uptrend losing power', direction: dir, weight: 1 })
    if (reclaim) reasons.push({ label: long ? 'Price reclaiming EMA10' : 'Price losing EMA10', direction: dir, weight: 1 })

    let confidence = 55
    confidence += clamp((long ? p.rsiOversold - rsiX.value : rsiX.value - p.rsiOverbought) * 1.2, 0, 14)
    confidence += clamp(rsiX.rightLeg * 1.2, 0, 10)
    confidence += clamp((long ? ema10Slope + p.fakeSlope : p.fakeSlope - ema10Slope) * 35, 0, 8)
    if (macdV) confidence += 6
    if (swing.divergence) confidence += 12
    if (climax) confidence += 8
    if (sharpReversal) confidence += 4
    if (rejection) confidence += 6
    if (!swing.beyond) confidence += 6
    if (reclaim) confidence += 6

    return {
        kind: long ? 'LONG' : 'SHORT',
        confidence: clamp(Math.round(confidence), 0, 96),
        reasons,
        pattern: long ? 'V-bounce' : 'Inverted-V',
        fake: false,
        stopAnchor: prices[priceX.index],
        noSetup: false,
        hint: ''
    }
}

/**
 * The V Bounce strategy.
 * LONG  — RSI V from oversold + price V below EMA10, when the downtrend has lost
 *         power (else fake).
 * SHORT — the mirror: RSI inverted-V from overbought + price inverted-V above
 *         EMA10, when the uptrend has lost power. A powerful, volume-backed
 *         breakout is rejected as a likely LONG continuation, not a reversal.
 */
export const evaluateVBounce = (
    candles: Candle[],
    ind: Indicators,
    params: StrategyParams = DEFAULT_PARAMS
): VBounce => {
    if (candles.length < V_WINDOW + 2 || !Number.isFinite(ind.atr) || ind.atr <= 0) {
        return { kind: 'WAIT', confidence: 0, reasons: [], pattern: 'No setup', fake: false, stopAnchor: null }
    }

    const long = evaluateDirection(candles, ind, 'long', params)
    if (long.kind === 'LONG' || long.fake) return long

    const short = evaluateDirection(candles, ind, 'short', params)
    if (short.kind === 'SHORT' || short.fake) return short

    // Neither side: surface the more specific hint (a detected-but-shallow turn).
    const hint = !long.noSetup ? '' : long.hint !== 'No clean turn yet' ? long.hint : short.hint
    return {
        kind: 'WAIT',
        confidence: 0,
        reasons: [{ label: hint || 'No V / inverted-V forming yet', direction: 'neutral', weight: 0 }],
        pattern: 'No setup',
        fake: false,
        stopAnchor: null
    }
}
