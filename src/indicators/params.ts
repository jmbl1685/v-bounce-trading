/** Tunable V Bounce strategy parameters (the knobs exposed in the backtester). */
export interface StrategyParams {
    /** RSI trough must be ≤ this for a long V (overbought mirror = 100 − this). */
    rsiOversold: number
    rsiOverbought: number
    /** |EMA10 slope per bar / ATR| above which the trend "has power" → fake. */
    fakeSlope: number
    /** Window-vs-baseline volume that counts as a capitulation climax. */
    climaxVol: number
    /** Minimum price move per V leg, as a fraction of ATR. */
    priceLegAtr: number
    /** Stop buffer beyond the V extreme, as a fraction of ATR. */
    stopCushionAtr: number
    /** Backtest max hold in bars (0 = auto from the timeframe). */
    holdBars: number
}

export const DEFAULT_PARAMS: StrategyParams = {
    rsiOversold: 30,
    rsiOverbought: 70,
    fakeSlope: 0.14,
    climaxVol: 2.5,
    priceLegAtr: 0.22,
    stopCushionAtr: 0.25,
    holdBars: 0
}
