import type { Candle, Indicators, Signal, SignalKind } from '../types'
import { evaluateVBounce } from './vbounce'
import { DEFAULT_PARAMS, type StrategyParams } from './params'

interface Plan {
    entry: number | null
    stopLoss: number | null
    takeProfit: number | null
    riskReward: number | null
    planBasis: string | null
}

const EMPTY_PLAN: Plan = {
    entry: null,
    stopLoss: null,
    takeProfit: null,
    riskReward: null,
    planBasis: null
}

const usableAtr = (ind: Indicators): number => {
    if (ind.atr > 0 && Number.isFinite(ind.atr)) return ind.atr
    if (ind.support !== null && ind.resistance !== null) return ind.resistance - ind.support
    return ind.price * 0.004
}

/**
 * Levels for a V bounce. The stop is anchored just beyond the V low / inverted-V
 * high (the price that invalidates the bounce); the target is the first real
 * resistance/support that clears 1R, else the EMA reclaim, else an ATR
 * projection. No fixed percentages, no canned reward:risk.
 */
const planBounce = (ind: Indicators, kind: SignalKind, anchor: number | null, cushionAtr: number): Plan => {
    if (kind === 'WAIT') return EMPTY_PLAN

    const price = ind.price
    const atr = usableAtr(ind)
    const cushion = cushionAtr * atr
    const long = kind === 'LONG'

    const entry = price
    const stopLoss = long
        ? Math.min(anchor ?? price - 1.5 * atr, price - 0.5 * atr) - cushion
        : Math.max(anchor ?? price + 1.5 * atr, price + 0.5 * atr) + cushion

    const risk = Math.abs(entry - stopLoss)
    const dir = long ? 1 : -1

    // Structural targets on the far side of the trade.
    const pool = ind.levels
        .map((l) => l.price)
        .filter((p) => dir * (p - price) > 0)
        .sort((a, b) => dir * (a - b))

    let takeProfit: number | null = null
    let basis = ''
    for (const lvl of pool) {
        if (dir * (lvl - entry) >= risk) {
            takeProfit = lvl
            basis = long ? 'resistance' : 'support'
            break
        }
    }
    // Mean-reversion fallback: the EMA the price is reverting toward.
    if (takeProfit === null) {
        const ema = dir * (ind.ema22 - price) > 0 ? ind.ema22 : dir * (ind.ema10 - price) > 0 ? ind.ema10 : null
        if (ema !== null) {
            takeProfit = ema
            basis = 'EMA reclaim'
        }
    }
    if (takeProfit === null) {
        takeProfit = entry + dir * 2 * atr
        basis = 'ATR projection'
    }

    const reward = Math.abs(takeProfit - entry)
    const riskReward = risk > 0 ? reward / risk : null
    const planBasis = `Stop @ ${long ? 'V-low' : 'V-high'} · Target @ ${basis}`

    return { entry, stopLoss, takeProfit, riskReward, planBasis }
}

/** Run the V Bounce strategy and attach a dynamic trade plan. */
export const buildSignal = (
    ind: Indicators,
    candles: Candle[],
    params: StrategyParams = DEFAULT_PARAMS
): Signal => {
    const v = evaluateVBounce(candles, ind, params)
    const plan = v.kind === 'WAIT' ? EMPTY_PLAN : planBounce(ind, v.kind, v.stopAnchor, params.stopCushionAtr)

    const reasons = v.reasons
        .filter((r) => r.direction !== 'neutral' || v.kind === 'WAIT')
        .sort((a, b) => b.weight - a.weight)

    return {
        kind: v.kind,
        confidence: v.confidence,
        reasons,
        pattern: v.pattern,
        fake: v.fake,
        entry: plan.entry,
        stopLoss: plan.stopLoss,
        takeProfit: plan.takeProfit,
        riskReward: plan.riskReward,
        planBasis: plan.planBasis
    }
}
