---
name: market-data
description: Guardrail + map for live Binance market data. Read BEFORE adding or changing anything that fetches prices, candles, tickers, or the market list. Enforces WebSocket-only live data and prevents the REST-polling pattern that gets the IP rate-limited/banned (-1003/418).
---

# Market data (Binance) — rules & map

This app streams live futures data. Getting this wrong gets the user's **IP banned** (Binance
-1003 / HTTP 418). These rules are non-negotiable (also in `CLAUDE.md`).

## Hard rules

- **Live price/candle updates MUST come from a WebSocket** — the `@kline` stream, or the Binance
  **WebSocket API** (request/response). Never from repeated REST.
- **Never add a `setInterval`/loop that calls a REST market-data endpoint** (`/klines`, `/ticker`,
  `/ticker/24hr`, `/ticker/price`, …). Polling REST is exactly what triggers the ban.
- **REST is allowed only for a one-time historical seed** when the WebSocket can't deliver it — and
  even then, prefer the WS API seed first, and always honor the cooldown breaker.
- Be **visibility-aware**: throttle/stop work when `document.hidden` so a backgrounded tab doesn't
  burn the request-weight budget.

## The pieces (use these, don't reinvent)

- `src/services/binanceSource.ts` — futures vs spot sources, the `SOURCE_CHAIN`, and the
  preferred-source persistence. Futures market-data WS is geo-restricted in some regions, so the app
  fails over to spot.
- `src/services/binanceSocket.ts` — `MarketStream`: the kline WS with watchdog, backoff reconnect,
  and "opened-but-silent" (geo-tarpit) detection.
- `src/services/binanceWsApi.ts` — `fetchKlinesWs`: seed klines over the **WS API** (no REST weight,
  dodges bans). Prefer this for seeds.
- `src/services/binanceRest.ts` — `fetchKlines` (throttled, cooldown-aware) and `fetchKlinesVia`
  (WS-API-first, REST fallback). The **last-resort** seed path.
- `src/services/binanceCooldown.ts` — the IP-ban breaker: `restBlocked()`, `restCooldownMs()`,
  `noteRestOk/Fail()`, `noteRestBannedUntil()`, `parseBanUntil()`, `throttled()`. **Respect it** in
  any REST call.
- `src/hooks/useAssetStream.ts` — the orchestrator per symbol: seed → kline WS → watchdog → source
  failover → and only as a *degraded last resort*, a slow (`POLL_MS = 20000`) WS-API refresh. Study
  this before touching the live pipeline.
- `src/services/binanceDirectory.ts` — the market list: a **one-time** `exchangeInfo` + `ticker/24hr`
  fetch (futures-first, per-source timeout, memoized). Not polled.

## When adding a market-data feature

1. Can a WebSocket deliver it? Use `MarketStream` (stream) or `fetchKlinesWs` (request/response).
2. Need history once? `fetchKlinesVia` (WS-API first, REST fallback) — never on an interval.
3. Touching REST at all? Gate on `restBlocked()` and report failures via `noteRestFail()` /
   `noteRestBannedUntil(parseBanUntil(msg))`.
4. Make it visibility-aware.

## Note: account/trading REST is different

Signed account endpoints (`/fapi/v2/balance`, `positionRisk`, orders) are *not* market data and are
polled in `useRealAccount.ts` — but still **visibility-aware and weight-conscious** (e.g. avoid
`/openOrders`, weight 40; TP/SL is app-managed locally in `realTpSl.ts`). Keep per-poll weight low.
