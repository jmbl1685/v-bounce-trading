// Signed Binance USDⓈ-M Futures REST client. Runs entirely in the browser:
// requests are HMAC-SHA256 signed with the secret key via the Web Crypto API.
// CORS is permitted by Binance for these endpoints (verified).

import { restBlocked, restCooldownMs, noteRestOk, noteRestFail, noteRestBannedUntil, parseBanUntil } from './binanceCooldown'

const REAL_BASE = 'https://fapi.binance.com'
const TEST_BASE = 'https://testnet.binancefuture.com'

export type MarginType = 'ISOLATED' | 'CROSSED'

export interface Credentials {
    apiKey: string
    secretKey: string
    testnet: boolean
}

export interface RealPosition {
    symbol: string
    base: string
    side: 'LONG' | 'SHORT'
    qty: number // absolute base qty
    entryPrice: number
    markPrice: number
    pnl: number
    leverage: number
    liqPrice: number
    /** Existing TP/SL stop prices read back from open orders. */
    tp: number | null
    sl: number | null
}

const enc = new TextEncoder()
const baseUrl = (c: Credentials) => (c.testnet ? TEST_BASE : REAL_BASE)

let timeOffset = 0
let synced = false

const hmacHex = async (secret: string, msg: string): Promise<string> => {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

const syncTime = async (c: Credentials) => {
    try {
        const res = await fetch(`${baseUrl(c)}/fapi/v1/time`)
        const json = await res.json()
        timeOffset = json.serverTime - Date.now()
        synced = true
    } catch {
        /* fall back to local clock */
    }
}

const signed = async (
    c: Credentials,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, string | number> = {}
): Promise<any> => {
    if (restBlocked()) {
        throw new Error(`Binance rate-limit cooldown — retry in ${Math.ceil(restCooldownMs() / 1000)}s`)
    }
    if (!synced) await syncTime(c)
    const query = new URLSearchParams({
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        timestamp: String(Date.now() + timeOffset),
        recvWindow: '5000'
    }).toString()
    const signature = await hmacHex(c.secretKey, query)
    const url = `${baseUrl(c)}${path}?${query}&signature=${signature}`
    try {
        const res = await fetch(url, { method, headers: { 'X-MBX-APIKEY': c.apiKey } })
        const data = await res.json().catch(() => ({}))
        // 418 = IP ban, 429 = rate limit. Honor the exact unban time if given.
        if (res.status === 418 || res.status === 429) {
            const until = parseBanUntil(data?.msg)
            if (until) noteRestBannedUntil(until)
            else noteRestFail()
            throw new Error(data?.msg ? `Binance: ${data.msg}` : `Binance rate limit (${res.status})`)
        }
        if (!res.ok) {
            // A genuine API error (e.g. bad order params) is NOT a rate-limit —
            // don't trip the breaker on it.
            throw new Error(data?.msg ? `Binance: ${data.msg}` : `HTTP ${res.status}`)
        }
        noteRestOk()
        return data
    } catch (err) {
        if (err instanceof TypeError) noteRestFail() // network / CORS-masked ban
        throw err
    }
}

/** Validate keys by reading the futures balance; throws with the Binance message on failure. */
export const getUsdtBalance = async (c: Credentials): Promise<number> => {
    const balances: { asset: string; balance: string }[] = await signed(c, 'GET', '/fapi/v2/balance')
    const usdt = balances.find((b) => b.asset === 'USDT')
    return usdt ? parseFloat(usdt.balance) : 0
}

// Position mode (one-way vs hedge) is account-wide; cache per key.
const dualSideCache = new Map<string, boolean>()
const getDualSide = async (c: Credentials): Promise<boolean> => {
    const key = `${c.apiKey}:${c.testnet}`
    const cached = dualSideCache.get(key)
    if (cached !== undefined) return cached
    const r = await signed(c, 'GET', '/fapi/v1/positionSide/dual')
    const dual = !!r.dualSidePosition
    dualSideCache.set(key, dual)
    return dual
}

export const getPositions = async (c: Credentials): Promise<RealPosition[]> => {
    // Only positionRisk (weight 5). We no longer read /fapi/v1/openOrders
    // (weight 40) for TP/SL — those are app-managed locally — which is the bulk
    // of the per-poll request weight and was tripping the IP rate limit.
    const raw: any[] = await signed(c, 'GET', '/fapi/v2/positionRisk')
    return raw
        .filter((p) => parseFloat(p.positionAmt) !== 0)
        .map((p) => {
            const amt = parseFloat(p.positionAmt)
            const side: 'LONG' | 'SHORT' = amt > 0 ? 'LONG' : 'SHORT'
            return {
                symbol: p.symbol,
                base: p.symbol.replace(/USDT$|BUSD$|USDC$/, ''),
                side,
                qty: Math.abs(amt),
                entryPrice: parseFloat(p.entryPrice),
                markPrice: parseFloat(p.markPrice),
                pnl: parseFloat(p.unRealizedProfit),
                leverage: parseFloat(p.leverage),
                liqPrice: parseFloat(p.liquidationPrice),
                tp: null,
                sl: null
            }
        })
}

/** Set isolated/cross margin type for a symbol; ignores the "no change needed" error. */
export const setMarginType = async (c: Credentials, symbol: string, marginType: MarginType): Promise<void> => {
    try {
        await signed(c, 'POST', '/fapi/v1/marginType', { symbol, marginType })
    } catch (e) {
        if (!/No need to change|-4046/i.test(e instanceof Error ? e.message : '')) throw e
    }
}

// --- Futures contract filters --------------------------------------------------
// Precision MUST come from the futures contract we actually trade on (fapi /
// testnet), NOT the market directory — that can fall back to spot, whose
// step/tick sizes allow more decimals than the perpetual and trigger -1111
// ("Precision is over the maximum defined for this asset").

interface Filters {
    stepStr: string // LOT_SIZE / MARKET_LOT_SIZE step, e.g. '0.001'
    tickStr: string // PRICE_FILTER tick, e.g. '0.01'
    minNotional: number
}

const filtersCache = new Map<string, Filters>()

/** Decimals implied by a step/tick string, e.g. '0.001' → 3, '1' → 0. */
const stepDecimals = (step: string): number => {
    const t = step.replace(/0+$/, '')
    const dot = t.indexOf('.')
    return dot === -1 ? 0 : t.length - dot - 1
}

const getFilters = async (c: Credentials, symbol: string): Promise<Filters> => {
    const key = `${baseUrl(c)}:${symbol}`
    const cached = filtersCache.get(key)
    if (cached) return cached
    const res = await fetch(`${baseUrl(c)}/fapi/v1/exchangeInfo?symbol=${symbol}`)
    const json = await res.json().catch(() => ({}))
    const s = (json.symbols ?? []).find((x: any) => x.symbol === symbol)
    const f: any[] = s?.filters ?? []
    const lot = f.find((x) => x.filterType === 'MARKET_LOT_SIZE') ?? f.find((x) => x.filterType === 'LOT_SIZE')
    const price = f.find((x) => x.filterType === 'PRICE_FILTER')
    const notional = f.find((x) => x.filterType === 'MIN_NOTIONAL')
    const filters: Filters = {
        stepStr: lot?.stepSize ?? '0.001',
        tickStr: price?.tickSize ?? '0.01',
        minNotional: parseFloat(notional?.notional ?? notional?.minNotional ?? '5')
    }
    filtersCache.set(key, filters)
    return filters
}

/** Round a quantity DOWN to the contract's step size (never over-order). */
const roundQty = (qty: number, stepStr: string): string => {
    const step = parseFloat(stepStr)
    const decimals = stepDecimals(stepStr)
    if (!(step > 0)) return qty.toFixed(decimals)
    return (Math.floor(qty / step) * step).toFixed(decimals)
}

/** Round a price to the nearest valid tick. */
const roundPrice = (price: number, tickStr: string): string => {
    const tick = parseFloat(tickStr)
    const decimals = stepDecimals(tickStr)
    if (!(tick > 0)) return price.toFixed(decimals)
    return (Math.round(price / tick) * tick).toFixed(decimals)
}

export interface OrderPlan {
    symbol: string
    side: 'LONG' | 'SHORT'
    margin: number
    leverage: number
    marginType: MarginType
    price: number
    quantity: number
    notional: number
    minNotional: number
}

/** Compute the order size for a margin/leverage/price, respecting the contract's filters. */
export const planOrder = async (
    c: Credentials,
    symbol: string,
    side: 'LONG' | 'SHORT',
    margin: number,
    leverage: number,
    marginType: MarginType,
    price: number
): Promise<OrderPlan> => {
    const { stepStr, minNotional } = await getFilters(c, symbol)
    const notional = margin * leverage
    const quantity = parseFloat(roundQty(notional / price, stepStr))
    return { symbol, side, margin, leverage, marginType, price, quantity, notional, minNotional }
}

/** Set margin type + leverage, then market-order to open the position. */
export const openPosition = async (c: Credentials, plan: OrderPlan): Promise<void> => {
    if (plan.notional < plan.minNotional) {
        throw new Error(`Order ${plan.notional.toFixed(2)} USDT is below the ${plan.minNotional} USDT minimum`)
    }
    const dual = await getDualSide(c)
    const { stepStr } = await getFilters(c, plan.symbol)
    await setMarginType(c, plan.symbol, plan.marginType)
    await signed(c, 'POST', '/fapi/v1/leverage', { symbol: plan.symbol, leverage: plan.leverage })

    const params: Record<string, string | number> = {
        symbol: plan.symbol,
        side: plan.side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: roundQty(plan.quantity, stepStr)
    }
    if (dual) params.positionSide = plan.side
    await signed(c, 'POST', '/fapi/v1/order', params)
}

/** Cancel any TP/SL orders, then market-close the position. */
export const closePosition = async (c: Credentials, pos: RealPosition): Promise<void> => {
    const dual = await getDualSide(c)
    const { stepStr } = await getFilters(c, pos.symbol)
    await signed(c, 'DELETE', '/fapi/v1/allOpenOrders', { symbol: pos.symbol }).catch(() => {})

    const params: Record<string, string | number> = {
        symbol: pos.symbol,
        side: pos.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: roundQty(pos.qty, stepStr)
    }
    if (dual) params.positionSide = pos.side
    else params.reduceOnly = 'true'
    await signed(c, 'POST', '/fapi/v1/order', params)
}

/**
 * Replace this position's TP/SL with reduce-only conditional stop orders.
 *
 * We deliberately do NOT use `closePosition=true`: on some accounts Binance
 * classifies close-all conditionals as algo orders and rejects them on this
 * endpoint ("Order type not supported … use the Algo Order API endpoints
 * instead"). A reduce-only STOP_MARKET / TAKE_PROFIT_MARKET with an explicit
 * quantity is a plain conditional order and is universally accepted; the qty is
 * the full position, so it still closes the whole thing when triggered.
 */
export const setTpSl = async (
    c: Credentials,
    pos: RealPosition,
    tp: number | null,
    sl: number | null
): Promise<void> => {
    const dual = await getDualSide(c)
    const { tickStr, stepStr } = await getFilters(c, pos.symbol)
    const exit = pos.side === 'LONG' ? 'SELL' : 'BUY'
    const quantity = roundQty(pos.qty, stepStr)
    await signed(c, 'DELETE', '/fapi/v1/allOpenOrders', { symbol: pos.symbol }).catch(() => {})

    const stop = async (type: 'TAKE_PROFIT_MARKET' | 'STOP_MARKET', stopPrice: number) => {
        const params: Record<string, string | number> = {
            symbol: pos.symbol,
            side: exit,
            type,
            stopPrice: roundPrice(stopPrice, tickStr),
            quantity,
            workingType: 'MARK_PRICE'
        }
        // Hedge mode can't take reduceOnly — positionSide makes it reduce-only.
        if (dual) params.positionSide = pos.side
        else params.reduceOnly = 'true'
        await signed(c, 'POST', '/fapi/v1/order', params)
    }
    if (tp !== null) await stop('TAKE_PROFIT_MARKET', tp)
    if (sl !== null) await stop('STOP_MARKET', sl)
}
