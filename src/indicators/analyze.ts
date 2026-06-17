import type { Candle, Indicators } from '../types'
import { ema, emaSeries } from './ema'
import { rsi, rsiSeries } from './rsi'
import { macd, macdHistSeries } from './macd'
import { atr } from './atr'
import { detectStructure, detectSmartMoney } from './structure'

const SLOPE_BARS = 5

/** Compute the full indicator snapshot from a candle series. */
export const analyze = (candles: Candle[]): Indicators | null => {
    if (candles.length < 30) return null

    const closes = candles.map((c) => c.close)
    const price = closes[closes.length - 1]

    const ema10 = ema(closes, 10)
    const ema22 = ema(closes, 22)
    const ema55 = ema(closes, 55)
    const atrValue = atr(candles, 14)
    const structure = detectStructure(candles)
    const smartMoney = detectSmartMoney(candles)

    // EMA10 slope over the last few bars, normalised by ATR so it reads as
    // "ATR of drift per bar" — the core downtrend / fake-bounce filter.
    const ema10Arr = emaSeries(closes, 10)
    let ema10Slope = 0
    if (ema10Arr.length > SLOPE_BARS && atrValue > 0) {
        const recent = ema10Arr[ema10Arr.length - 1]
        const past = ema10Arr[ema10Arr.length - 1 - SLOPE_BARS]
        ema10Slope = (recent - past) / atrValue / SLOPE_BARS
    }

    // Trend from EMA alignment relative to price.
    let trend: Indicators['trend'] = 'range'
    if (price > ema22 && ema10 > ema22 && ema22 > ema55) trend = 'up'
    else if (price < ema22 && ema10 < ema22 && ema22 < ema55) trend = 'down'

    return {
        price,
        ema10,
        ema22,
        ema55,
        rsi: rsi(closes, 14),
        rsiSeries: rsiSeries(closes, 14),
        macd: macd(closes),
        macdHist: macdHistSeries(closes),
        atr: atrValue,
        ema10Slope,
        support: structure.support,
        resistance: structure.resistance,
        levels: structure.levels,
        smartMoney,
        trend
    }
}
