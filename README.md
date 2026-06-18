# ⚡ Multi‑Strategy — Crypto Futures Signal Dashboard

Real‑time **crypto futures signal dashboard** with **8 switchable trading strategies** on live Binance data — each with backtesting, paper trading, and real order execution. Built with **React + TypeScript + Vite**.

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

- 🧩 **8 switchable strategies** — pick one from the header; every card recomputes its signals **live** (no reload), and the backtest verdict follows. Each strategy has an illustrated example and a plain‑language explainer.
- 📡 **Live data over WebSocket** — prices and candles stream from the Binance WebSocket (with spot fallback when futures is geo‑blocked). No REST polling — a circuit breaker keeps it inside Binance IP limits.
- 🧠 **Real indicators** — EMA, RSI, MACD, ATR, ADX/DMI, Bollinger/Keltner, Stochastic, structure & order‑block detection — all computed client‑side.
- 🔬 **Backtesting & auto‑optimize** — replay the active strategy bar‑by‑bar, see results in **R**, and auto‑tune parameters per symbol.
- 🧪 **Paper trading** — full simulator with margin, leverage, isolated/cross, taker/maker fees, funding, TP/SL and liquidation.
- 💸 **Real trading** — market orders, close, and app‑managed TP/SL on your live Binance Futures account (testnet supported). Balance / margin / available, plus a local **close‑history** and a **PnL‑history** calendar + chart.
- 💱 **Display currency** — show account money in your local currency at a rate you set.
- 🔔 **Browser notifications** — background‑safe alerts on fresh, high‑confidence signals.
- 🌗 **Light / dark themes**, **EN / ES** localization, and a **technical‑mode** toggle for a minimal view.

---

## 🎯 The strategies

Choose any from the **Strategy** selector in the header. Each returns a LONG / SHORT / WAIT signal with a dynamic stop/target plan, the same freshness + reward:risk guards, and a backtest verdict.

| Strategy | Idea |
| --- | --- |
| **V‑Bounce** | RSI + price carve a **V / inverted‑V** — an exhaustion reversal, with a trend‑power "fake" filter and capitulation override. |
| **Bollinger Bands** | **Mean‑reversion** — a pierce beyond a ±2σ band that reclaims it, reverting toward the middle band (SMA 20). |
| **TradingLatino** | Jaime Merino's method — **EMA55 backbone + DMI/ADX direction + LazyBear Squeeze Momentum** trigger. |
| **Supertrend** | **ATR trend‑flip line** — take the fresh flip, trail the stop on the line. |
| **EMA Pullback** | **Buy the dip in a trend** — stacked EMAs + a pullback to the 22‑EMA that resumes. |
| **Donchian Breakout** | **Turtle** 20‑bar range breakout, trailing the opposite 10‑bar channel. |
| **Smart Money (SMC)** | **Break of structure + order block** — trade the BOS while price holds its order block. |
| **Stochastic** | **Pullback timing** — a %K/%D cross out of oversold/overbought, filtered by the trend. |

A signal only fires when the **trigger is fresh** *and* there is real reward left in the plan.

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

Open the **Positions** panel → switch to **Real** → add your Binance Futures **API key + secret** (a **testnet** toggle is available). Keys live only in your browser's `localStorage` and are HMAC‑signed locally via the Web Crypto API — they are never sent to any server but Binance.

> [!NOTE]
> Some accounts reject native conditional orders, so **TP/SL is app‑managed**: the levels are stored locally and the position is market‑closed when the price hits them — **active only while the tab is open**. This is surfaced clearly in the UI.

---

## ☁️ Deployment

Hosted on **Vercel** via its native Git integration — pushing to **`main`** ships to production.

```bash
pnpm run deploy   # bump version, tag, push main → production
```

---

## 🛠️ Tech stack

**React 18** · **TypeScript** · **Vite 6** · **Sass** (CSS custom‑property theming) · React Context · Binance USDⓈ‑M Futures REST + WebSocket · Web Crypto API · Service Worker.

---

<div align="center">

[![Created by Claude Code](https://img.shields.io/badge/Created%20by-Claude%20Code-d97757?style=for-the-badge&logo=claude&logoColor=white)](https://claude.com/claude-code)

*Under Juan Batty technical instructions | 0 human codification*

</div>
