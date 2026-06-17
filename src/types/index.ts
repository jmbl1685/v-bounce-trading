export type Interval = '1m' | '5m' | '15m' | '1h' | '4h'

export type SignalKind = 'LONG' | 'SHORT' | 'WAIT'

export interface Candle {
    openTime: number
    open: number
    high: number
    low: number
    close: number
    volume: number
    closed: boolean
}

export interface MacdPoint {
    macd: number
    signal: number
    histogram: number
}

export interface StructureLevel {
    price: number
    kind: 'support' | 'resistance'
    strength: number
}

export interface SmartMoney {
    bias: 'bullish' | 'bearish' | 'neutral'
    /** Break of structure detected on the latest swing. */
    breakOfStructure: boolean
    /** Latest order block midpoint price, if any. */
    orderBlock: number | null
    /** Volume of the last candle relative to its moving average (1 = average). */
    volumeRatio: number
}

export interface Indicators {
    price: number
    ema10: number
    ema22: number
    ema55: number
    rsi: number
    /** Recent RSI values aligned to the candle series, for V-shape detection. */
    rsiSeries: number[]
    macd: MacdPoint
    /** Recent MACD histogram aligned to the candle series, for V-shape detection. */
    macdHist: number[]
    /** Average True Range in price units — live volatility for adaptive sizing. */
    atr: number
    /** EMA10 slope per bar, normalised by ATR (negative = falling = downtrend). */
    ema10Slope: number
    support: number | null
    resistance: number | null
    levels: StructureLevel[]
    smartMoney: SmartMoney
    trend: 'up' | 'down' | 'range'
}

export interface SignalReason {
    label: string
    direction: 'bull' | 'bear' | 'neutral'
    weight: number
}

export interface Signal {
    kind: SignalKind
    confidence: number
    reasons: SignalReason[]
    /** Detected pattern, e.g. 'V-bounce', 'Inverted-V', 'No setup'. */
    pattern: string
    /** True when a V/inverted-V formed but the trend makes it a likely fake. */
    fake: boolean
    entry: number | null
    stopLoss: number | null
    takeProfit: number | null
    /** Reward-to-risk ratio of the proposed plan (target dist / stop dist). */
    riskReward: number | null
    /** Plain-language note on how the levels were anchored. */
    planBasis: string | null
}

export type AssetStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'error'

export interface AssetState {
    symbol: string
    interval: Interval
    status: AssetStatus
    /** Which Binance market is currently feeding this asset. */
    source: 'futures' | 'spot'
    /** Price decimals from the symbol's tick size; null until resolved. */
    priceDecimals: number | null
    candles: Candle[]
    indicators: Indicators | null
    signal: Signal | null
    /** Latest last-trade price; ticks every aggTrade for a real-time display. */
    livePrice: number | null
    lastUpdate: number
    /** Milliseconds since the last WebSocket tick (0 when never received). */
    lastTickAt: number
    /** Reconnect attempts since the last successful open. */
    reconnectAttempts: number
    priceChangePct: number
}
