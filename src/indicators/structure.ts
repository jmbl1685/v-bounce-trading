import type { Candle, StructureLevel, SmartMoney } from '../types'

/**
 * Detect swing pivots using a fractal window: a pivot high has `left`/`right`
 * neighbours strictly lower, a pivot low has neighbours strictly higher.
 */
const findPivots = (candles: Candle[], window = 2) => {
    const highs: { index: number; price: number }[] = []
    const lows: { index: number; price: number }[] = []

    for (let i = window; i < candles.length - window; i++) {
        const c = candles[i]
        let isHigh = true
        let isLow = true
        for (let j = i - window; j <= i + window; j++) {
            if (j === i) continue
            if (candles[j].high >= c.high) isHigh = false
            if (candles[j].low <= c.low) isLow = false
        }
        if (isHigh) highs.push({ index: i, price: c.high })
        if (isLow) lows.push({ index: i, price: c.low })
    }

    return { highs, lows }
}

/**
 * Cluster nearby pivot prices into structural levels and rank them by how many
 * pivots reinforce each level (strength).
 */
const clusterLevels = (
    pivots: { index: number; price: number }[],
    kind: 'support' | 'resistance',
    tolerance: number
): StructureLevel[] => {
    const levels: StructureLevel[] = []

    for (const pivot of pivots) {
        const match = levels.find(
            (l) => Math.abs(l.price - pivot.price) / pivot.price <= tolerance
        )
        if (match) {
            // Weighted blend toward the cluster mean, bump the strength.
            match.price = (match.price * match.strength + pivot.price) / (match.strength + 1)
            match.strength += 1
        } else {
            levels.push({ price: pivot.price, kind, strength: 1 })
        }
    }

    return levels.sort((a, b) => b.strength - a.strength)
}

export interface StructureResult {
    levels: StructureLevel[]
    support: number | null
    resistance: number | null
}

/** Build the support/resistance map and pick the nearest level on each side. */
export const detectStructure = (candles: Candle[]): StructureResult => {
    if (candles.length < 10) {
        return { levels: [], support: null, resistance: null }
    }

    const tolerance = 0.0025 // 0.25% price clustering band
    const { highs, lows } = findPivots(candles)
    const price = candles[candles.length - 1].close

    const resistances = clusterLevels(highs, 'resistance', tolerance)
    const supports = clusterLevels(lows, 'support', tolerance)
    const levels = [...resistances, ...supports]

    const nearestSupport = supports
        .filter((l) => l.price < price)
        .sort((a, b) => b.price - a.price)[0]

    const nearestResistance = resistances
        .filter((l) => l.price > price)
        .sort((a, b) => a.price - b.price)[0]

    return {
        levels,
        support: nearestSupport ? nearestSupport.price : null,
        resistance: nearestResistance ? nearestResistance.price : null
    }
}

/**
 * Approximate institutional ("smart money") footprint:
 * - Break of structure: latest close pierces the most recent opposing pivot.
 * - Order block: the last opposing candle before an impulsive move.
 * - Volume ratio: last candle volume vs. its 20-period average.
 */
export const detectSmartMoney = (candles: Candle[]): SmartMoney => {
    if (candles.length < 25) {
        return { bias: 'neutral', breakOfStructure: false, orderBlock: null, volumeRatio: 1 }
    }

    const last = candles[candles.length - 1]
    const lookback = candles.slice(-20)
    const avgVol = lookback.reduce((s, c) => s + c.volume, 0) / lookback.length
    const volumeRatio = avgVol > 0 ? last.volume / avgVol : 1

    const { highs, lows } = findPivots(candles)
    const lastHigh = highs[highs.length - 1]
    const lastLow = lows[lows.length - 1]

    let breakOfStructure = false
    let bias: SmartMoney['bias'] = 'neutral'

    if (lastHigh && last.close > lastHigh.price) {
        breakOfStructure = true
        bias = 'bullish'
    } else if (lastLow && last.close < lastLow.price) {
        breakOfStructure = true
        bias = 'bearish'
    } else {
        // Lean on the body direction of the impulsive last candle.
        const body = last.close - last.open
        if (volumeRatio > 1.4 && body > 0) bias = 'bullish'
        else if (volumeRatio > 1.4 && body < 0) bias = 'bearish'
    }

    // Order block: last candle of the opposite colour before the recent impulse.
    let orderBlock: number | null = null
    for (let i = candles.length - 2; i >= Math.max(0, candles.length - 12); i--) {
        const c = candles[i]
        const bullishOb = bias === 'bullish' && c.close < c.open
        const bearishOb = bias === 'bearish' && c.close > c.open
        if (bullishOb || bearishOb) {
            orderBlock = (c.high + c.low) / 2
            break
        }
    }

    return { bias, breakOfStructure, orderBlock, volumeRatio }
}
