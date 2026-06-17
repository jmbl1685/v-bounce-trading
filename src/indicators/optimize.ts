import type { Candle, Interval } from '../types'
import { runBacktestOn, type BacktestResult, type PrecomputedBar } from './backtest'
import { DEFAULT_PARAMS, type StrategyParams } from './params'

// The parameter grid swept by the optimizer. Kept modest so a sweep stays quick.
const GRID = {
    rsiOversold: [25, 30, 35],
    fakeSlope: [0.1, 0.16, 0.22],
    climaxVol: [2.0, 2.8],
    stopCushionAtr: [0.1, 0.3, 0.6]
}

// Require a minimum sample so we don't "optimize" onto one lucky trade.
const MIN_TRADES = 8

export interface OptimizeResult {
    params: StrategyParams
    result: BacktestResult
}

/** Rank a backtest: total R, but penalised hard when the sample is too small. */
const scoreOf = (r: BacktestResult): number =>
    r.total >= MIN_TRADES ? r.totalR : r.totalR - (MIN_TRADES - r.total)

const buildCombos = (): StrategyParams[] => {
    const combos: StrategyParams[] = []
    for (const rsiOversold of GRID.rsiOversold) {
        for (const fakeSlope of GRID.fakeSlope) {
            for (const climaxVol of GRID.climaxVol) {
                for (const stopCushionAtr of GRID.stopCushionAtr) {
                    combos.push({
                        ...DEFAULT_PARAMS,
                        rsiOversold,
                        rsiOverbought: 100 - rsiOversold,
                        fakeSlope,
                        climaxVol,
                        stopCushionAtr
                    })
                }
            }
        }
    }
    return combos
}

/**
 * Sweep the parameter grid over the precomputed bars and return the highest-
 * scoring set. Chunked with yields so the UI stays responsive and can show
 * progress. Bars are precomputed once by the caller, so each run is cheap.
 */
export const optimize = async (
    bars: PrecomputedBar[],
    candles: Candle[],
    interval: Interval,
    onProgress?: (done: number, total: number) => void
): Promise<OptimizeResult | null> => {
    const combos = buildCombos()
    let best: { params: StrategyParams; result: BacktestResult; score: number } | null = null

    for (let i = 0; i < combos.length; i++) {
        const result = runBacktestOn(bars, candles, interval, combos[i])
        const score = scoreOf(result)
        if (!best || score > best.score) best = { params: combos[i], result, score }
        if (i % 5 === 0) {
            onProgress?.(i + 1, combos.length)
            await new Promise((r) => setTimeout(r, 0))
        }
    }

    onProgress?.(combos.length, combos.length)
    return best ? { params: best.params, result: best.result } : null
}
