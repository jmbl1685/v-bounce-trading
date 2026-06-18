import type { Candle, Indicators, Signal, SignalReason } from '../types'
import { evaluateVBounce } from './vbounce'
import { bollingerResult } from './bollinger'
import { tradingLatinoResult } from './tradinglatino'
import { supertrendResult } from './supertrend'
import { emaPullbackResult } from './emapullback'
import { donchianResult } from './donchian'
import { smcResult } from './smc'
import { stochasticResult } from './stochastic'
import { EMPTY_PLAN, planFromAnchor } from './plan'
import { getActiveStrategy } from '../strategies/registry'
import type { StrategyResult } from '../strategies/types'
import { DEFAULT_PARAMS, type StrategyParams } from './params'

// A reversal whose target is already (nearly) reached has no reward left —
// reject it rather than signal an entry that chases a finished move.
const MIN_RR = 0.5

/** The V Bounce strategy with its dynamic trade plan, as a StrategyResult. */
const vbounceResult = (ind: Indicators, candles: Candle[], params: StrategyParams): StrategyResult => {
    const v = evaluateVBounce(candles, ind, params)
    const plan =
        v.kind === 'WAIT'
            ? EMPTY_PLAN
            : planFromAnchor(ind, v.kind, v.stopAnchor, params.stopCushionAtr, v.kind === 'LONG' ? 'V-low' : 'V-high')
    return {
        kind: v.kind,
        confidence: v.confidence,
        reasons: v.reasons,
        pattern: v.pattern,
        fake: v.fake,
        ...plan
    }
}

const strategyResult = (ind: Indicators, candles: Candle[], params: StrategyParams): StrategyResult => {
    switch (getActiveStrategy()) {
        case 'bollinger':
            return bollingerResult(ind, candles, params)
        case 'tradinglatino':
            return tradingLatinoResult(ind, candles, params)
        case 'supertrend':
            return supertrendResult(ind, candles, params)
        case 'emapullback':
            return emaPullbackResult(ind, candles, params)
        case 'donchian':
            return donchianResult(ind, candles, params)
        case 'smc':
            return smcResult(ind, candles, params)
        case 'stochastic':
            return stochasticResult(ind, candles, params)
        default:
            return vbounceResult(ind, candles, params)
    }
}

/** Run the active strategy and attach its dynamic trade plan. */
export const buildSignal = (
    ind: Indicators,
    candles: Candle[],
    params: StrategyParams = DEFAULT_PARAMS
): Signal => {
    let r = strategyResult(ind, candles, params)

    // No-reward guard (all strategies): the move has already played out.
    if (r.kind !== 'WAIT' && r.riskReward !== null && r.riskReward < MIN_RR) {
        r = {
            kind: 'WAIT',
            confidence: 0,
            reasons: [
                { label: `Move already played out — reward:risk ${r.riskReward.toFixed(2)} too low`, direction: 'neutral', weight: 0 }
            ],
            pattern: 'No setup',
            fake: false,
            entry: null,
            stopLoss: null,
            takeProfit: null,
            riskReward: null,
            planBasis: null
        }
    }

    const reasons: SignalReason[] = r.reasons
        .filter((reason) => reason.direction !== 'neutral' || r.kind === 'WAIT')
        .sort((a, b) => b.weight - a.weight)

    return {
        kind: r.kind,
        confidence: r.confidence,
        reasons,
        pattern: r.pattern,
        fake: r.fake,
        entry: r.entry,
        stopLoss: r.stopLoss,
        takeProfit: r.takeProfit,
        riskReward: r.riskReward,
        planBasis: r.planBasis
    }
}
