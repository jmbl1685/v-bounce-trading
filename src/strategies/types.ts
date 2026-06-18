import type { SignalKind, SignalReason } from '../types'

/** Every selectable trading strategy. */
export type StrategyKind =
    | 'vbounce'
    | 'bollinger'
    | 'tradinglatino'
    | 'supertrend'
    | 'emapullback'
    | 'donchian'
    | 'smc'
    | 'stochastic'

/**
 * What a strategy returns to the signal builder — the raw call plus reasons.
 * buildSignal then applies the generic guards (reward:risk floor) and formatting.
 */
export interface StrategyResult {
    kind: SignalKind
    confidence: number
    reasons: SignalReason[]
    pattern: string
    fake: boolean
    entry: number | null
    stopLoss: number | null
    takeProfit: number | null
    riskReward: number | null
    planBasis: string | null
}
