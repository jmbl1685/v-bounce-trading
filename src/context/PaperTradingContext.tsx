import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Interval } from '../types'

export type Side = 'LONG' | 'SHORT'
export type FeeMode = 'taker' | 'maker'

export type CloseReason = 'manual' | 'tp' | 'sl' | 'liq'

export interface Position {
    id: string
    symbol: string
    base: string
    side: Side
    entryPrice: number
    margin: number
    leverage: number
    qty: number
    decimals: number
    openedAt: number
    /** Timeframe the signal/position was opened on (e.g. '15m'). */
    interval?: Interval
    /** Fee rate locked in at open (so close uses the same rate). */
    feeRate: number
    /** Fee paid when the position was opened. */
    openFee: number
    /** Optional take-profit / stop-loss trigger prices. */
    tp: number | null
    sl: number | null
}

export interface ClosedTrade {
    id: string
    symbol: string
    base: string
    side: Side
    margin: number
    leverage: number
    pnl: number
    roe: number
    reason: CloseReason
    closedAt: number
}

interface Account {
    balance: number
    realized: number
}

export type MarginType = 'ISOLATED' | 'CROSSED'

export interface Defaults {
    margin: number
    leverage: number
    feeMode: FeeMode
    bnb: boolean
    marginType: MarginType
}

const DEFAULT_START = 1000
const DEFAULTS: Defaults = { margin: 60, leverage: 5, feeMode: 'taker', bnb: false, marginType: 'ISOLATED' }

// Binance USDⓈ-M Futures fees: taker 0.05%, maker 0.02%, −10% paying in BNB.
// Plus the baseline 0.01%/8h funding rate.
export const TAKER_RATE = 0.0005
export const MAKER_RATE = 0.0002
export const BNB_DISCOUNT = 0.9
export const FUNDING_RATE = 0.0001
const EIGHT_HOURS = 8 * 60 * 60 * 1000

/** Effective per-side fee rate for the chosen mode and BNB setting. */
export const feeRateOf = (mode: FeeMode, bnb: boolean): number =>
    (mode === 'maker' ? MAKER_RATE : TAKER_RATE) * (bnb ? BNB_DISCOUNT : 1)

export const openNotional = (p: Position): number => p.margin * p.leverage

/** Approx isolated-margin liquidation price (no maintenance-margin buffer). */
export const liqPrice = (p: Position): number =>
    p.side === 'LONG'
        ? p.entryPrice * (1 - 1 / p.leverage)
        : p.entryPrice * (1 + 1 / p.leverage)

/** Raw price PnL in USDT (before fees/funding). */
export const positionPnl = (p: Position, price: number): number =>
    p.side === 'LONG' ? p.qty * (price - p.entryPrice) : p.qty * (p.entryPrice - price)

/** Fee to close at `price`, using the rate locked in at open. */
export const closeFee = (p: Position, price: number): number =>
    p.qty * price * (p.feeRate ?? TAKER_RATE)

/** Accrued funding cost: longs pay, shorts receive (flat nominal rate). */
export const fundingCost = (p: Position, now: number): number =>
    openNotional(p) * FUNDING_RATE * ((now - p.openedAt) / EIGHT_HOURS) * (p.side === 'LONG' ? 1 : -1)

/** Net PnL if closed now: price PnL minus the close fee and accrued funding. */
export const netPnl = (p: Position, price: number, now: number): number =>
    positionPnl(p, price) - closeFee(p, price) - fundingCost(p, now)

interface PaperTradingValue {
    account: Account
    positions: Position[]
    closed: ClosedTrade[]
    defaults: Defaults
    startBalance: number
    open: (args: { symbol: string; base: string; side: Side; price: number; decimals: number; interval: Interval }) => boolean
    close: (id: string, price: number, reason?: CloseReason) => void
    setTpSl: (id: string, tp: number | null, sl: number | null) => void
    setDefaults: (d: Partial<Defaults>) => void
    setStartBalance: (v: number) => void
    reset: () => void
}

const PaperTradingContext = createContext<PaperTradingValue | null>(null)

const KEY = 'v-bounce-paper'

interface Persisted {
    account: Account
    positions: Position[]
    closed: ClosedTrade[]
    defaults: Defaults
    startBalance: number
}

const load = (): Persisted => {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
            const p = JSON.parse(raw) as Persisted
            return {
                account: p.account ?? { balance: DEFAULT_START, realized: 0 },
                positions: p.positions ?? [],
                closed: p.closed ?? [],
                defaults: { ...DEFAULTS, ...(p.defaults ?? {}) },
                startBalance: p.startBalance ?? DEFAULT_START
            }
        }
    } catch {
        /* ignore */
    }
    return {
        account: { balance: DEFAULT_START, realized: 0 },
        positions: [],
        closed: [],
        defaults: DEFAULTS,
        startBalance: DEFAULT_START
    }
}

let idSeq = 0
const newId = () => `${Date.now().toString(36)}-${idSeq++}`

export const PaperTradingProvider = ({ children }: { children: ReactNode }) => {
    const initial = useMemo(load, [])
    const [account, setAccount] = useState<Account>(initial.account)
    const [positions, setPositions] = useState<Position[]>(initial.positions)
    const [closed, setClosed] = useState<ClosedTrade[]>(initial.closed)
    const [defaults, setDefaultsState] = useState<Defaults>(initial.defaults)
    const [startBalance, setStartBalanceState] = useState<number>(initial.startBalance)

    const positionsRef = useRef(positions)
    useEffect(() => {
        positionsRef.current = positions
    }, [positions])

    useEffect(() => {
        localStorage.setItem(KEY, JSON.stringify({ account, positions, closed, defaults, startBalance }))
    }, [account, positions, closed, defaults, startBalance])

    const open: PaperTradingValue['open'] = useCallback(
        ({ symbol, base, side, price, decimals, interval }) => {
            if (!(price > 0)) return false
            const { margin, leverage } = defaults
            const feeRate = feeRateOf(defaults.feeMode, defaults.bnb)
            const openFee = margin * leverage * feeRate
            if (account.balance < margin + openFee) return false
            const qty = (margin * leverage) / price
            setAccount((a) => ({ balance: a.balance - margin - openFee, realized: a.realized - openFee }))
            setPositions((ps) => [
                { id: newId(), symbol, base, side, entryPrice: price, margin, leverage, qty, decimals, openedAt: Date.now(), interval, feeRate, openFee, tp: null, sl: null },
                ...ps
            ])
            return true
        },
        [account.balance, defaults]
    )

    const close = useCallback((id: string, price: number, reason: CloseReason = 'manual') => {
        const pos = positionsRef.current.find((p) => p.id === id)
        if (!pos) return
        // Remove from the ref immediately so a rapid double-call can't double-book.
        positionsRef.current = positionsRef.current.filter((p) => p.id !== id)

        const now = Date.now()
        // Liquidation wipes the margin; otherwise net of close fee + funding.
        const pnl = reason === 'liq' ? -pos.margin : netPnl(pos, price, now)
        const roe = (pnl / pos.margin) * 100
        setPositions((ps) => ps.filter((p) => p.id !== id))
        setAccount((a) => ({ balance: a.balance + pos.margin + pnl, realized: a.realized + pnl }))
        setClosed((c) =>
            [
                {
                    id: pos.id,
                    symbol: pos.symbol,
                    base: pos.base,
                    side: pos.side,
                    margin: pos.margin,
                    leverage: pos.leverage,
                    pnl,
                    roe,
                    reason,
                    closedAt: now
                },
                ...c
            ].slice(0, 30)
        )
    }, [])

    const setTpSl = useCallback((id: string, tp: number | null, sl: number | null) => {
        positionsRef.current = positionsRef.current.map((p) => (p.id === id ? { ...p, tp, sl } : p))
        setPositions((ps) => ps.map((p) => (p.id === id ? { ...p, tp, sl } : p)))
    }, [])

    const setDefaults = useCallback((d: Partial<Defaults>) => {
        setDefaultsState((prev) => ({
            ...prev,
            ...(d.margin !== undefined ? { margin: Math.max(1, d.margin) } : {}),
            ...(d.leverage !== undefined ? { leverage: Math.max(1, Math.min(125, d.leverage)) } : {}),
            ...(d.feeMode !== undefined ? { feeMode: d.feeMode } : {}),
            ...(d.bnb !== undefined ? { bnb: d.bnb } : {}),
            ...(d.marginType !== undefined ? { marginType: d.marginType } : {})
        }))
    }, [])

    const reset = useCallback(() => {
        setAccount({ balance: startBalance, realized: 0 })
        setPositions([])
        positionsRef.current = []
        setClosed([])
    }, [startBalance])

    // Set the bankroll. When flat, apply it immediately as a fresh start.
    const setStartBalance = useCallback((v: number) => {
        const amount = Math.max(1, v)
        setStartBalanceState(amount)
        if (positionsRef.current.length === 0) {
            setAccount({ balance: amount, realized: 0 })
            setClosed([])
        }
    }, [])

    const value = useMemo(
        () => ({ account, positions, closed, defaults, startBalance, open, close, setTpSl, setDefaults, setStartBalance, reset }),
        [account, positions, closed, defaults, startBalance, open, close, setTpSl, setDefaults, setStartBalance, reset]
    )

    return <PaperTradingContext.Provider value={value}>{children}</PaperTradingContext.Provider>
}

export const usePaperTrading = (): PaperTradingValue => {
    const ctx = useContext(PaperTradingContext)
    if (!ctx) throw new Error('usePaperTrading must be used within PaperTradingProvider')
    return ctx
}
