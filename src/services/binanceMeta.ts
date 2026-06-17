import type { BinanceSource } from './binanceSource'

interface RawFilter {
    filterType: string
    tickSize?: string
}

interface RawSymbol {
    symbol: string
    pricePrecision?: number
    filters?: RawFilter[]
}

// `${sourceId}:${symbol}` -> display decimals.
const decimalsCache = new Map<string, number>()
// De-dupe concurrent exchangeInfo fetches for the same URL.
const inflight = new Map<string, Promise<void>>()

/**
 * Number of decimals implied by a tick size string: '0.01000000' -> 2,
 * '0.00000001' -> 8, '1' -> 0.
 */
const tickToDecimals = (tickSize: string): number => {
    const trimmed = tickSize.replace(/0+$/, '')
    const dot = trimmed.indexOf('.')
    return dot === -1 ? 0 : trimmed.length - dot - 1
}

const decimalsForSymbol = (s: RawSymbol): number | null => {
    const priceFilter = s.filters?.find((f) => f.filterType === 'PRICE_FILTER')
    if (priceFilter?.tickSize) return tickToDecimals(priceFilter.tickSize)
    if (typeof s.pricePrecision === 'number') return s.pricePrecision
    return null
}

const populate = async (url: string, sourceId: string): Promise<void> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`exchangeInfo ${res.status}`)
    const data: { symbols?: RawSymbol[] } = await res.json()
    for (const s of data.symbols ?? []) {
        const decimals = decimalsForSymbol(s)
        if (decimals !== null) decimalsCache.set(`${sourceId}:${s.symbol}`, decimals)
    }
}

/**
 * Resolve the correct number of price decimals for a symbol from Binance's
 * exchange metadata. Spot supports a `?symbol=` lookup; futures returns the full
 * list (cached in one shot). Results are memoised; returns null if unavailable.
 */
export const fetchPriceDecimals = async (
    symbol: string,
    source: BinanceSource
): Promise<number | null> => {
    const key = `${source.id}:${symbol}`
    const cached = decimalsCache.get(key)
    if (cached !== undefined) return cached

    const url =
        source.id === 'spot'
            ? `${source.restBase}/exchangeInfo?symbol=${symbol}`
            : `${source.restBase}/exchangeInfo`

    if (!inflight.has(url)) {
        const job = populate(url, source.id)
            .catch(() => {
                /* leave uncached; caller falls back to a heuristic */
            })
            .finally(() => inflight.delete(url))
        inflight.set(url, job)
    }
    await inflight.get(url)

    const resolved = decimalsCache.get(key)
    return resolved !== undefined ? resolved : null
}
