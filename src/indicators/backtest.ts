import type { Candle, Indicators, Interval, Signal } from '../types'
import { analyze } from './analyze'
import { buildSignal } from './signal'
import { DEFAULT_PARAMS, type StrategyParams } from './params'
import { getHorizon } from '../utils/horizon'

export interface BacktestTrade {
    direction: 'LONG' | 'SHORT'
    entryTime: number
    entryPrice: number
    exitPrice: number
    rMultiple: number
    outcome: 'win' | 'loss' | 'timeout'
    barsHeld: number
}

export interface BacktestResult {
    trades: BacktestTrade[]
    total: number
    wins: number
    losses: number
    winRate: number
    avgR: number
    totalR: number
    profitFactor: number
    expectancy: number
    maxDrawdownR: number
    equity: number[] // cumulative R after each trade, seeded with 0
    longCount: number
    shortCount: number
    barsTested: number
}

const WARMUP = 60

interface SimExit {
    exitPrice: number
    rMultiple: number
    outcome: 'win' | 'loss' | 'timeout'
    exitIndex: number
}

/** Walk a trade forward to its stop or target; if neither hits, exit at maxHold. */
const simulate = (candles: Candle[], entryIdx: number, sig: Signal, maxHold: number): SimExit | null => {
    const long = sig.kind === 'LONG'
    const entry = sig.entry!
    const stop = sig.stopLoss!
    const target = sig.takeProfit!
    const risk = Math.abs(entry - stop)
    if (!(risk > 0)) return null

    const lastIdx = Math.min(entryIdx + maxHold, candles.length - 1)
    for (let j = entryIdx + 1; j <= lastIdx; j++) {
        const c = candles[j]
        if (long) {
            // Conservative: if both stop and target fall inside the bar, take the stop.
            if (c.low <= stop) return { exitPrice: stop, rMultiple: -1, outcome: 'loss', exitIndex: j }
            if (c.high >= target) return { exitPrice: target, rMultiple: (target - entry) / risk, outcome: 'win', exitIndex: j }
        } else {
            if (c.high >= stop) return { exitPrice: stop, rMultiple: -1, outcome: 'loss', exitIndex: j }
            if (c.low <= target) return { exitPrice: target, rMultiple: (entry - target) / risk, outcome: 'win', exitIndex: j }
        }
    }

    // Timed out — mark to the close at the hold limit.
    const exitPrice = candles[lastIdx].close
    const rMultiple = long ? (exitPrice - entry) / risk : (entry - exitPrice) / risk
    return { exitPrice, rMultiple, outcome: 'timeout', exitIndex: lastIdx }
}

/**
 * Replay the V Bounce strategy bar by bar over history. Each new signal opens one
 * position (entry at the bar close, with the signal's dynamic stop/target); the
 * trade is walked forward to whichever level hits first, or a time stop. Returns
 * R-multiple stats and an equity curve — a hypothetical, mechanical evaluation.
 */
/** A bar with its precomputed indicators — the expensive, param-independent step. */
export interface PrecomputedBar {
    index: number
    ind: Indicators
    slice: Candle[]
}

/**
 * Run analyze() for every tradable bar once. analyze is param-independent, so
 * this heavy step can be reused across many parameter sets (slider re-runs and
 * the optimizer sweep) instead of being repeated each time.
 */
export const precomputeBars = (candles: Candle[]): PrecomputedBar[] => {
    const bars: PrecomputedBar[] = []
    for (let i = WARMUP; i < candles.length - 1; i++) {
        const slice = candles.slice(0, i + 1)
        const ind = analyze(slice)
        if (ind) bars.push({ index: i, ind, slice })
    }
    return bars
}

/** Replay the strategy over precomputed bars for one parameter set (cheap). */
export const runBacktestOn = (
    bars: PrecomputedBar[],
    candles: Candle[],
    interval: Interval,
    params: StrategyParams
): BacktestResult => {
    const horizon = getHorizon(interval)
    const maxHold = params.holdBars > 0 ? params.holdBars : Math.max(12, horizon.validCandles * 4)
    const trades: BacktestTrade[] = []

    let prevKind: Signal['kind'] = 'WAIT'
    let lastExit = -1
    for (const bar of bars) {
        if (bar.index <= lastExit) continue // still inside a prior trade's span
        const sig = buildSignal(bar.ind, bar.slice, params)
        const k = sig.kind
        const tradable = k !== 'WAIT' && sig.entry !== null && sig.stopLoss !== null && sig.takeProfit !== null

        // Enter only on a fresh signal (rising edge), one position at a time.
        if (tradable && prevKind !== k) {
            const exit = simulate(candles, bar.index, sig, maxHold)
            if (exit) {
                trades.push({
                    direction: k === 'LONG' ? 'LONG' : 'SHORT',
                    entryTime: candles[bar.index].openTime,
                    entryPrice: sig.entry!,
                    exitPrice: exit.exitPrice,
                    rMultiple: exit.rMultiple,
                    outcome: exit.outcome,
                    barsHeld: exit.exitIndex - bar.index
                })
                prevKind = k
                lastExit = exit.exitIndex
                continue
            }
        }
        prevKind = k
    }

    return summarize(trades, candles.length - WARMUP)
}

export const runBacktest = (
    candles: Candle[],
    interval: Interval,
    params: StrategyParams = DEFAULT_PARAMS
): BacktestResult => runBacktestOn(precomputeBars(candles), candles, interval, params)

const summarize = (trades: BacktestTrade[], barsTested: number): BacktestResult => {
    const equity = [0]
    let cum = 0
    let grossWin = 0
    let grossLoss = 0
    let wins = 0
    let peak = 0
    let maxDrawdownR = 0

    for (const t of trades) {
        cum += t.rMultiple
        equity.push(cum)
        if (t.rMultiple > 0) {
            wins += 1
            grossWin += t.rMultiple
        } else {
            grossLoss += Math.abs(t.rMultiple)
        }
        peak = Math.max(peak, cum)
        maxDrawdownR = Math.max(maxDrawdownR, peak - cum)
    }

    const total = trades.length
    const totalR = cum
    const losses = total - wins

    return {
        trades,
        total,
        wins,
        losses,
        winRate: total ? (wins / total) * 100 : 0,
        avgR: total ? totalR / total : 0,
        totalR,
        profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
        expectancy: total ? totalR / total : 0,
        maxDrawdownR,
        equity,
        longCount: trades.filter((t) => t.direction === 'LONG').length,
        shortCount: trades.filter((t) => t.direction === 'SHORT').length,
        barsTested
    }
}
