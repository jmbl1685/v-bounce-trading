export type SourceId = 'futures' | 'spot'

export interface BinanceSource {
    id: SourceId
    label: string
    /** REST base exposing `/klines` and `/ticker/price`. */
    restBase: string
    /** WebSocket host root; combined streams are built as `<wsHost>/stream?streams=…`. */
    wsHost: string
}

// USDT-M futures. Most faithful to a futures system, but its market-data WS is
// geo-restricted in some regions (connects, then streams nothing).
export const FUTURES_SOURCE: BinanceSource = {
    id: 'futures',
    label: 'Futures',
    restBase: 'https://fapi.binance.com/fapi/v1',
    wsHost: 'wss://fstream.binance.com'
}

// Spot. Prices track the perp within a few basis points and the public
// market-data stream is available far more widely, so it's our fallback.
export const SPOT_SOURCE: BinanceSource = {
    id: 'spot',
    label: 'Spot',
    restBase: 'https://api.binance.com/api/v3',
    wsHost: 'wss://stream.binance.com:9443'
}

/** Order in which sources are attempted before giving up. */
export const SOURCE_CHAIN: BinanceSource[] = [FUTURES_SOURCE, SPOT_SOURCE]

const PREF_KEY = 'v-bounce-source'

/** The source the app should try first, biased by what last delivered data. */
export const getPreferredSource = (): BinanceSource => {
    const stored = localStorage.getItem(PREF_KEY)
    return SOURCE_CHAIN.find((s) => s.id === stored) ?? SOURCE_CHAIN[0]
}

/** Persist the source that successfully delivered live frames. */
export const rememberSource = (id: SourceId) => {
    localStorage.setItem(PREF_KEY, id)
}

/** The next source to try after `current`, or null when the chain is exhausted. */
export const nextSource = (current: BinanceSource): BinanceSource | null => {
    const idx = SOURCE_CHAIN.findIndex((s) => s.id === current.id)
    return idx >= 0 && idx + 1 < SOURCE_CHAIN.length ? SOURCE_CHAIN[idx + 1] : null
}

/** All sources to try, in order, starting with the preferred one. */
export const orderedSources = (preferred: BinanceSource): BinanceSource[] => [
    preferred,
    ...SOURCE_CHAIN.filter((s) => s.id !== preferred.id)
]
