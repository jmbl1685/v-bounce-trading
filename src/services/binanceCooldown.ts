// Circuit breaker for Binance REST.
//
// When the IP is rate-limited Binance replies 429, then bans with 418. Because
// those responses are cross-origin and carry no CORS headers, the browser turns
// them into opaque `fetch` rejections (TypeError) — we usually can't even read
// the status. So we trip on consecutive failures instead of status codes, and
// while tripped every caller short-circuits WITHOUT hitting the network, which
// is the only way to let an active ban expire instead of extending it.

const TRIP_AFTER = 4 // consecutive failures before we back off
const COOLDOWN_MS = 90_000 // how long to stay backed off once tripped

let failures = 0
let until = 0

/** True while we're backing off — callers should skip the request entirely. */
export const restBlocked = (): boolean => Date.now() < until

/** Milliseconds left on the current cooldown (0 when not blocked). */
export const restCooldownMs = (): number => Math.max(0, until - Date.now())

/** Record a successful request — clears the failure streak and any cooldown. */
export const noteRestOk = (): void => {
    failures = 0
    until = 0
}

/** Record a rate-limit / network failure — trips the breaker past the threshold. */
export const noteRestFail = (): void => {
    failures += 1
    if (failures >= TRIP_AFTER) until = Date.now() + COOLDOWN_MS
}

/**
 * Binance bans include the unban epoch-ms in the message ("banned until …").
 * When we can read it (signed endpoints are CORS-enabled), honor it exactly so
 * we resume the moment the ban lifts — not a second sooner.
 */
export const noteRestBannedUntil = (ts: number): void => {
    if (Number.isFinite(ts) && ts > Date.now()) {
        until = Math.max(until, ts)
        failures = Math.max(failures, TRIP_AFTER)
    }
}

/** Pull the unban timestamp out of a Binance ban message, if present. */
export const parseBanUntil = (msg: string | undefined): number | null => {
    const m = msg?.match(/banned until (\d+)/i)
    return m ? Number(m[1]) : null
}
