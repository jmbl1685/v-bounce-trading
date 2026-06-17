// A tiny non-reactive price cache. Asset cards write their live price here on
// every tick; the positions panel reads it on a timer to compute live PnL —
// this avoids pushing high-frequency price updates through React state.
const prices = new Map<string, number>()

export const setPrice = (symbol: string, price: number) => {
    prices.set(symbol, price)
}

export const getPrice = (symbol: string): number | undefined => prices.get(symbol)
