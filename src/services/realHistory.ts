// Local close-history for REAL positions. Binance keeps trade history server
// side, but it doesn't carry our app's context (which timeframe, why it closed),
// so we log a compact record locally whenever the app closes a position — the
// manual Close button or an app-managed TP/SL hit. Mirrors demo's `closed` list.

import type { RealPosition } from './binanceTrade'
import { getPositionMeta } from './realPositionMeta'
import { Store } from '../utils/store'

export interface RealClosed {
    id: string
    symbol: string
    base: string
    side: 'LONG' | 'SHORT'
    leverage: number
    entryPrice: number
    exitPrice: number
    qty: number
    pnl: number
    reason: 'manual' | 'tp' | 'sl'
    interval: string | null
    closedAt: number
    strategy?: string
    openedAt?: number
}

const KEY = 'v-bounce-real-history'
const CAP = 100
const listeners = new Set<() => void>()

const read = (): RealClosed[] => Store.get<RealClosed[]>(KEY, [])

const write = (list: RealClosed[]) => {
    Store.set(KEY, list)
    listeners.forEach((fn) => fn())
}

export const subscribeRealHistory = (fn: () => void): (() => void) => {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}

export const getRealHistory = (): RealClosed[] => read()

export const clearRealHistory = (): void => write([])

/** Log a just-closed real position. PnL/exit are taken at close time. */
export const recordRealClose = (pos: RealPosition, reason: RealClosed['reason']): void => {
    const closedAt = Date.now()
    const meta = getPositionMeta(pos.symbol)
    const rec: RealClosed = {
        id: `${pos.symbol}-${closedAt}`,
        symbol: pos.symbol,
        base: pos.base,
        side: pos.side,
        leverage: pos.leverage,
        entryPrice: pos.entryPrice,
        exitPrice: pos.markPrice,
        qty: pos.qty,
        pnl: pos.pnl,
        reason,
        interval: meta?.interval ?? null,
        closedAt,
        strategy: meta?.strategy,
        openedAt: meta?.openedAt
    }
    write([rec, ...read()].slice(0, CAP))
}
