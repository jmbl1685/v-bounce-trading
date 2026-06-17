import { useEffect, useRef, useState } from 'react'
import type { AssetState, AssetStatus, Candle, Indicators, Interval, Signal } from '../types'
import { fetchKlines } from '../services/binanceRest'
import { fetchPriceDecimals } from '../services/binanceMeta'
import { MarketStream } from '../services/binanceSocket'
import {
    getPreferredSource,
    orderedSources,
    rememberSource,
    type BinanceSource
} from '../services/binanceSource'
import { analyze } from '../indicators/analyze'
import { buildSignal } from '../indicators/signal'
import { DEFAULT_PARAMS, type StrategyParams } from '../indicators/params'

const MAX_CANDLES = 320

// Indicators recompute at most this often; the price/sparkline still tick every
// frame. Keeps the signal stable and analysis cheap under a fast trade feed.
const ANALYZE_THROTTLE_MS = 250

// REST-polling cadence used when no WebSocket can stream a symbol (e.g. a
// futures-only perp on a network where the futures WS is tarpitted).
const POLL_MS = 3000

interface Analysis {
    indicators: Indicators | null
    signal: Signal | null
    priceChangePct: number
}

const computeChangePct = (candles: Candle[]): number => {
    if (candles.length < 2) return 0
    const first = candles[0].close
    const last = candles[candles.length - 1].close
    return first > 0 ? ((last - first) / first) * 100 : 0
}

const runAnalysis = (candles: Candle[], params: StrategyParams): Analysis => {
    const indicators = analyze(candles)
    const signal = indicators ? buildSignal(indicators, candles, params) : null
    return { indicators, signal, priceChangePct: computeChangePct(candles) }
}

/** Merge an updated candle into the series in place (replace last or append). */
const mergeCandle = (candles: Candle[], candle: Candle) => {
    const last = candles[candles.length - 1]
    if (last && last.openTime === candle.openTime) {
        candles[candles.length - 1] = candle
    } else if (!last || candle.openTime > last.openTime) {
        candles.push(candle)
        if (candles.length > MAX_CANDLES) candles.shift()
    }
}

/**
 * Streams one futures symbol and keeps it relentlessly online:
 * - REST seed → kline WebSocket with watchdog/backoff reconnect,
 * - automatic source fail-over (futures → spot) when an endpoint opens but
 *   never streams (geo-tarpitted), re-seeding so prices stay continuous,
 * - network and tab-visibility recovery.
 * Indicators recompute on every tick (rAF-throttled); status changes update the
 * tag without re-running analysis.
 */
export const useAssetStream = (
    symbol: string,
    interval: Interval,
    params: StrategyParams = DEFAULT_PARAMS
): AssetState => {
    const initialSource = getPreferredSource()
    const [state, setState] = useState<AssetState>(() => ({
        symbol,
        interval,
        status: 'connecting',
        source: initialSource.id,
        priceDecimals: null,
        candles: [],
        indicators: null,
        signal: null,
        livePrice: null,
        lastUpdate: Date.now(),
        lastTickAt: 0,
        reconnectAttempts: 0,
        priceChangePct: 0
    }))

    const candlesRef = useRef<Candle[]>([])
    const analysisRef = useRef<Analysis>({ indicators: null, signal: null, priceChangePct: 0 })
    const paramsRef = useRef<StrategyParams>(params)
    const decimalsRef = useRef<number | null>(null)
    const livePriceRef = useRef<number | null>(null)
    const lastAnalyzeRef = useRef(0)
    const statusRef = useRef<AssetStatus>('connecting')
    const sourceRef = useRef<BinanceSource>(initialSource)
    const attemptsRef = useRef(0)
    const lastTickRef = useRef(0)
    const frameRef = useRef<number | null>(null)
    const dirtyRef = useRef(false)
    const activeRef = useRef(true)

    useEffect(() => {
        activeRef.current = true
        let stream: MarketStream | null = null
        let pollTimer: number | null = null
        const candidates = orderedSources(getPreferredSource())

        const stopPolling = () => {
            if (pollTimer !== null) {
                window.clearInterval(pollTimer)
                pollTimer = null
            }
        }

        const emit = (status: AssetStatus) => {
            if (!activeRef.current) return
            statusRef.current = status
            const { indicators, signal, priceChangePct } = analysisRef.current
            setState({
                symbol,
                interval,
                status,
                source: sourceRef.current.id,
                priceDecimals: decimalsRef.current,
                candles: candlesRef.current.slice(),
                indicators,
                signal,
                livePrice: livePriceRef.current,
                lastUpdate: Date.now(),
                lastTickAt: lastTickRef.current,
                reconnectAttempts: attemptsRef.current,
                priceChangePct
            })
        }

        // One render per animation frame. The price/sparkline update every frame;
        // the heavier indicator analysis is throttled so the signal stays stable.
        const scheduleFlush = () => {
            dirtyRef.current = true
            if (frameRef.current !== null) return
            frameRef.current = window.requestAnimationFrame(() => {
                frameRef.current = null
                if (!dirtyRef.current) return
                dirtyRef.current = false
                const now = Date.now()
                if (now - lastAnalyzeRef.current >= ANALYZE_THROTTLE_MS) {
                    lastAnalyzeRef.current = now
                    analysisRef.current = runAnalysis(candlesRef.current, paramsRef.current)
                }
                emit('live')
            })
        }

        // Last resort when no WebSocket can stream the symbol: poll recent klines
        // over REST (which works even where the WS is tarpitted) for live-ish data.
        const startPolling = (source: BinanceSource) => {
            stopPolling()
            const poll = async () => {
                try {
                    const recent = await fetchKlines(symbol, interval, 3, source)
                    if (!activeRef.current || recent.length === 0) return
                    for (const c of recent) mergeCandle(candlesRef.current, c)
                    const candles = candlesRef.current
                    livePriceRef.current = candles[candles.length - 1].close
                    lastTickRef.current = Date.now()
                    scheduleFlush()
                } catch {
                    /* transient — the next interval retries */
                }
            }
            pollTimer = window.setInterval(poll, POLL_MS)
            poll()
        }

        // Seed + stream the symbol, walking the source chain. Each candidate is
        // probed by its REST seed; a source that opens but never streams (or has
        // no further fallback) drops to REST polling.
        const startFrom = async (index: number) => {
            if (index >= candidates.length) {
                emit('error')
                return
            }
            const source = candidates[index]
            sourceRef.current = source
            attemptsRef.current = 0
            stopPolling()
            emit('connecting')

            // Resolve display precision from the symbol's tick size (cached).
            fetchPriceDecimals(symbol, source).then((decimals) => {
                if (activeRef.current && decimals !== null) {
                    decimalsRef.current = decimals
                    emit(statusRef.current)
                }
            })
            try {
                const history = await fetchKlines(symbol, interval, MAX_CANDLES, source)
                if (!activeRef.current) return
                candlesRef.current = history
                analysisRef.current = runAnalysis(history, paramsRef.current)
                livePriceRef.current = history.length ? history[history.length - 1].close : null
                lastAnalyzeRef.current = Date.now()
                lastTickRef.current = Date.now()
                emit('live')
            } catch {
                // Symbol not on this source (or network error) — try the next.
                startFrom(index + 1)
                return
            }

            stream?.close()
            stream = new MarketStream(source.wsHost, symbol, interval, {
                onCandle: (candle) => {
                    mergeCandle(candlesRef.current, candle)
                    livePriceRef.current = candle.close
                    lastTickRef.current = Date.now()
                    attemptsRef.current = 0
                    rememberSource(source.id)
                    if (candle.closed) {
                        // A candle closed — recompute the signal now. WebSocket
                        // messages still arrive while the tab is backgrounded (rAF
                        // doesn't), so this keeps signals/alerts live in the
                        // background, when they matter most.
                        analysisRef.current = runAnalysis(candlesRef.current, paramsRef.current)
                        lastAnalyzeRef.current = Date.now()
                        emit('live')
                    } else {
                        scheduleFlush()
                    }
                },
                onPrice: (price) => {
                    // Patch the in-progress candle so price + sparkline tick in
                    // real time between the slower kline updates. Volume is left
                    // to the authoritative kline feed.
                    const candles = candlesRef.current
                    const last = candles[candles.length - 1]
                    if (!last) return
                    last.close = price
                    if (price > last.high) last.high = price
                    if (price < last.low) last.low = price
                    livePriceRef.current = price
                    lastTickRef.current = Date.now()
                    scheduleFlush()
                },
                onOpen: () => {
                    attemptsRef.current = 0
                    if (statusRef.current !== 'live') emit('live')
                },
                onReconnecting: (attempt) => {
                    attemptsRef.current = attempt
                    emit(navigator.onLine ? 'reconnecting' : 'offline')
                },
                onDead: () => {
                    // Opened but never streamed. Try the next source's socket, or
                    // fall back to REST polling on this (already-seeded) source.
                    stream?.close()
                    stream = null
                    if (index + 1 < candidates.length) {
                        startFrom(index + 1)
                    } else {
                        startPolling(source)
                    }
                },
                onError: () => {
                    if (statusRef.current === 'live') emit('reconnecting')
                }
            })
            stream.connect()
        }

        const onOnline = () => {
            emit('reconnecting')
            stream?.forceReconnect()
        }
        const onOffline = () => emit('offline')
        const onVisible = () => {
            if (document.visibilityState === 'visible' && statusRef.current !== 'live') {
                stream?.forceReconnect()
            }
        }

        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        document.addEventListener('visibilitychange', onVisible)

        startFrom(0)

        return () => {
            activeRef.current = false
            if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
            document.removeEventListener('visibilitychange', onVisible)
            stopPolling()
            stream?.close()
        }
    }, [symbol, interval])

    // Re-evaluate the signal immediately when the strategy params change, without
    // touching the live socket. Subsequent ticks also pick up paramsRef.
    useEffect(() => {
        paramsRef.current = params
        if (candlesRef.current.length === 0) return
        const analysis = runAnalysis(candlesRef.current, params)
        analysisRef.current = analysis
        lastAnalyzeRef.current = Date.now()
        setState((s) => ({
            ...s,
            indicators: analysis.indicators,
            signal: analysis.signal,
            priceChangePct: analysis.priceChangePct,
            lastUpdate: Date.now()
        }))
    }, [params])

    return state
}
