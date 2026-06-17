import type { Candle, Interval } from '../types'

// If no frame arrives within this window the connection is treated as dead and
// force-reconnected. With aggTrade we expect several frames/sec, so silence
// this long means a half-open socket.
const STALE_MS = 12000
const WATCHDOG_MS = 3000

// After the socket opens, if not a single frame arrives within this window the
// endpoint is considered geo-tarpitted (accepts the connection, streams
// nothing) and `onDead` fires so the caller can fail over to another source.
const FIRST_FRAME_MS = 3500

interface KlineData {
    t: number // kline start time
    o: string
    h: string
    l: string
    c: string
    v: string
    x: boolean // is this kline closed?
}

interface CombinedMessage {
    stream: string
    data: {
        k?: KlineData // kline event
        p?: string // aggTrade price
    }
}

export interface MarketHandlers {
    /** Authoritative candle update from the kline stream. */
    onCandle: (candle: Candle) => void
    /** Live last-trade price from the aggTrade stream (fires several times/sec). */
    onPrice: (price: number) => void
    /** Fired when the socket opens and is receiving data. */
    onOpen?: () => void
    /** Fired when the socket drops and a retry is scheduled (attempt = 1-based). */
    onReconnecting?: (attempt: number) => void
    /** Fired when the socket opens but never streams — caller should fail over. */
    onDead?: () => void
    onError?: () => void
}

/**
 * Streams one symbol over a single combined WebSocket carrying both the
 * `@kline_<interval>` feed (authoritative OHLCV, ~0.5/s) and the `@aggTrade`
 * feed (live last-trade price, several/s). The kline drives indicators; the
 * aggTrade drives the real-time ticking price.
 *
 * Stays online aggressively: backoff reconnect, a watchdog that revives a
 * silent half-open socket, dead-endpoint detection, and `forceReconnect()`.
 */
export class MarketStream {
    private ws: WebSocket | null = null
    private closedByUser = false
    private retries = 0
    private reconnectTimer: number | null = null
    private watchdogTimer: number | null = null
    private firstFrameTimer: number | null = null
    private receivedFrame = false
    private lastMessageAt = 0

    constructor(
        private readonly wsHost: string,
        private readonly symbol: string,
        private readonly interval: Interval,
        private readonly handlers: MarketHandlers
    ) {}

    connect() {
        this.closedByUser = false
        this.cleanupSocket()

        const sym = this.symbol.toLowerCase()
        const streams = `${sym}@kline_${this.interval}/${sym}@aggTrade`
        let ws: WebSocket
        try {
            ws = new WebSocket(`${this.wsHost}/stream?streams=${streams}`)
        } catch {
            this.scheduleReconnect()
            return
        }
        this.ws = ws

        ws.onopen = () => {
            this.retries = 0
            this.receivedFrame = false
            this.lastMessageAt = nowMs()
            this.startWatchdog()
            this.startFirstFrameTimer()
            this.handlers.onOpen?.()
        }

        ws.onmessage = (event) => {
            this.lastMessageAt = nowMs()
            if (!this.receivedFrame) {
                this.receivedFrame = true
                this.clearFirstFrameTimer()
            }
            try {
                const msg: CombinedMessage = JSON.parse(event.data)
                if (msg.stream?.includes('@aggTrade') && msg.data.p) {
                    this.handlers.onPrice(parseFloat(msg.data.p))
                } else if (msg.data.k) {
                    const k = msg.data.k
                    this.handlers.onCandle({
                        openTime: k.t,
                        open: parseFloat(k.o),
                        high: parseFloat(k.h),
                        low: parseFloat(k.l),
                        close: parseFloat(k.c),
                        volume: parseFloat(k.v),
                        closed: k.x
                    })
                }
            } catch {
                /* ignore malformed frames */
            }
        }

        ws.onerror = () => {
            this.handlers.onError?.()
        }

        ws.onclose = () => {
            this.stopWatchdog()
            this.clearFirstFrameTimer()
            if (this.closedByUser) return
            this.scheduleReconnect()
        }
    }

    /** Immediately drop any existing socket and reconnect with a fresh backoff. */
    forceReconnect() {
        if (this.closedByUser) return
        this.retries = 0
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.connect()
    }

    close() {
        this.closedByUser = true
        if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.stopWatchdog()
        this.clearFirstFrameTimer()
        this.cleanupSocket()
    }

    private scheduleReconnect() {
        const attempt = this.retries + 1
        this.retries = attempt
        this.handlers.onReconnecting?.(attempt)
        // Exponential backoff with jitter, capped at 15s.
        const backoff = Math.min(15000, 1000 * 2 ** (attempt - 1))
        const jitter = backoff * 0.25 * Math.random()
        this.reconnectTimer = window.setTimeout(() => this.connect(), backoff + jitter)
    }

    private startWatchdog() {
        this.stopWatchdog()
        this.watchdogTimer = window.setInterval(() => {
            if (this.closedByUser) return
            if (nowMs() - this.lastMessageAt > STALE_MS) {
                // Half-open socket: tear it down and reconnect now.
                this.forceReconnect()
            }
        }, WATCHDOG_MS)
    }

    private stopWatchdog() {
        if (this.watchdogTimer) {
            window.clearInterval(this.watchdogTimer)
            this.watchdogTimer = null
        }
    }

    private startFirstFrameTimer() {
        this.clearFirstFrameTimer()
        this.firstFrameTimer = window.setTimeout(() => {
            if (this.closedByUser || this.receivedFrame) return
            // Opened but silent — this endpoint is tarpitted. Hand off to caller.
            this.handlers.onDead?.()
        }, FIRST_FRAME_MS)
    }

    private clearFirstFrameTimer() {
        if (this.firstFrameTimer) {
            window.clearTimeout(this.firstFrameTimer)
            this.firstFrameTimer = null
        }
    }

    private cleanupSocket() {
        if (this.ws) {
            this.ws.onopen = null
            this.ws.onmessage = null
            this.ws.onerror = null
            this.ws.onclose = null
            try {
                this.ws.close()
            } catch {
                /* already closing */
            }
            this.ws = null
        }
    }
}

// Date.now() isolated here so the rest of the module stays pure.
const nowMs = () => Date.now()
