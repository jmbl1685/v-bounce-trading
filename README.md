# ⚡ V‑Bounce — Crypto Futures Signal Dashboard

Real‑time **crypto futures signal dashboard** that spots **RSI + price “V‑bounce” reversals** on live Binance data — with backtesting, paper trading, and real order execution. Built with **React + TypeScript + Vite**.

<div align="center">

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

</div>

> [!WARNING]
> **Educational use only — not financial advice.** Signals are derived from public Binance market data. Real trading uses your own funds and API keys at your own risk. Always test on **paper** or **testnet** first.

---

## ✨ Features

- 📈 **Live V‑Bounce signals** — RSI + price reversal detection streamed over the Binance WebSocket (with spot fallback when futures is geo‑blocked).
- 🧠 **Real indicators** — EMA, RSI, MACD, ATR computed client‑side; V / inverted‑V shape detection with a trend‑power “fake” filter and a capitulation override.
- 🔬 **Backtesting & auto‑optimize** — replay the strategy bar‑by‑bar, see results in **R**, and auto‑tune parameters per symbol.
- 🧪 **Paper trading** — full simulator with margin, leverage, isolated/cross, taker/maker fees, funding, TP/SL and liquidation.
- 💸 **Real trading** — place market orders, close positions, and arm TP/SL on your live Binance Futures account (testnet supported). Keys are stored locally in your browser and HMAC‑signed via the Web Crypto API.
- 🔔 **Browser notifications** — background‑safe alerts on fresh, high‑confidence signals (Service Worker + Notifications API).
- 🌗 **Light / dark themes** and **EN / ES** localization.
- 🛡️ **Rate‑limit aware** — a circuit breaker backs off automatically to respect Binance IP limits.

---

## 🎯 The strategy

| Signal | Condition |
| --- | --- |
| **LONG (V‑bounce)** | RSI carves a **V out of oversold (≤ 30)** *and* price carves a **V below EMA10** — buyers stepping in after sellers exhaust. |
| **SHORT (inverted‑V)** | The mirror — RSI peaks out of **overbought (≥ 70)** and price tops **above EMA10**. |
| **MACD confirmation** | The MACD histogram carving its own V (momentum turning) adds confidence. |
| **Fake filter** | If the trend still has power (EMA10 sloping steeply, a fresh lower‑low / higher‑high with no divergence, or a volume‑backed breakout) the setup is flagged a likely **continuation** and it waits. |
| **Capitulation override** | A genuine volume climax + sharp RSI snap‑back rescues violent flushes that are real bottoms/tops. |
| **Trade plan** | Entry at the reclaim, stop just beyond the V’s extreme, target at the next structure/EMA — every distance scaled by live volatility (**ATR**), with the resulting reward:risk shown. |

A signal only fires when the **turn is confirmed** *and* the prevailing trend has lost its power.

---

## 🚀 Getting started

> Requires [Node 20+](https://nodejs.org) and [pnpm](https://pnpm.io) (this project uses **pnpm** — never `npm`/`yarn`).

```bash
pnpm install      # install dependencies
pnpm dev          # start the dev server at http://localhost:5173
pnpm build        # type-check + production build to dist/
pnpm preview      # preview the production build
```

---

## 🔑 Real trading (optional)

Open the **Positions** panel → switch to **Real** → add your Binance Futures **API key + secret** (a **testnet** toggle is available). Keys live only in your browser’s `localStorage` and are signed locally — they are never sent to any server but Binance.

> [!NOTE]
> Some accounts reject native conditional orders, so **TP/SL is app‑managed**: the levels are stored locally and the position is market‑closed when the price hits them — **active only while the tab is open**. This is surfaced clearly in the UI.

---

## ☁️ Deployment

Pushes to the **`deploy`** branch ship to **Vercel production** via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

```bash
pnpm run deploy   # force-pushes main → deploy, triggering the workflow
```

Set these repository **secrets** (Settings → Secrets and variables → Actions): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

---

## 🛠️ Tech stack

**React 18** · **TypeScript** · **Vite 6** · **Sass** (CSS custom‑property theming) · React Context · Binance USDⓈ‑M Futures REST + WebSocket · Web Crypto API · Service Worker.

---

<div align="center">

[![Created by Claude Code](https://img.shields.io/badge/Created%20by-Claude%20Code-d97757?style=for-the-badge&logo=claude&logoColor=white)](https://claude.com/claude-code)

*Under Juan Batty technical instructions*

</div>
