import { useMemo } from 'react'
import { emaSeries } from '../../indicators/ema'
import { rsiSeries } from '../../indicators/rsi'
import { macdHistSeries } from '../../indicators/macd'
import { useI18n } from '../../context/I18nContext'
import './SampleChart.scss'

interface Bar {
    open: number
    high: number
    low: number
    close: number
}

// Deterministic RNG so the sample looks identical every time.
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// A textbook V-bounce: warm-up range → steep decline into oversold → sharp V low
// → the reclaim (entry, near the low) → the bounce running up to the target.
// Three streams keep the core decline/bounce closes identical regardless of the
// warm-up bars (added only so MACD 12/26/9 has enough history to compute).
const buildBars = (): Bar[] => {
    const warm = mulberry32(3)
    const rnd = mulberry32(9)
    const wick = mulberry32(7)
    const closes: number[] = []

    let wp = 103
    for (let i = 0; i < 16; i++) {
        wp += (warm() - 0.5) * 1.3
        closes.push(wp)
    }
    let p = 104
    for (let i = 0; i < 15; i++) {
        p += (rnd() - 0.5) * 1.5
        closes.push(p)
    }
    for (let i = 0; i < 9; i++) {
        p += -1.7 + (rnd() - 0.5) * 1.6
        closes.push(p)
    }
    for (let i = 0; i < 9; i++) {
        p += 1.25 + rnd() * 0.7
        closes.push(p)
    }
    return closes.map((c, i) => {
        const open = i > 0 ? closes[i - 1] : c
        const high = Math.max(open, c) + wick() * 0.5
        const low = Math.min(open, c) - wick() * 0.5
        return { open, high, low, close: c }
    })
}

const W = 640
const P_TOP = 22
const P_BOT = 210
const R_TOP = 240
const R_BOT = 318
const M_TOP = 346
const M_BOT = 436
const H = 460
const PAD_L = 14
const PAD_R = 70
const RSI_PAD = 8 // vertical breathing room inside the RSI pane
const MACD_SCALE = 0.5 // histogram amplitude as a share of the half-pane
const GOLD = '#f0b429'

// A hand-drawn "swoosh" V marker (curved smile turning up at the right, with a
// small arrowhead) anchored just below a turning point.
const Swoosh = ({ x, y, color }: { x: number; y: number; color: string }) => (
    <g fill='none' stroke={color} strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'>
        <path d={`M${x - 10},${y - 2} Q${x - 6},${y + 9} ${x + 1},${y + 7} Q${x + 9},${y + 4} ${x + 13},${y - 8}`} />
        <path d={`M${x + 13},${y - 8} l-6,-0.5 M${x + 13},${y - 8} l-0.5,6`} />
    </g>
)

export const SampleChart = () => {
    const { t } = useI18n()

    const model = useMemo(() => {
        const bars = buildBars()
        const closes = bars.map((b) => b.close)
        const ema = emaSeries(closes, 10)
        const rsi = rsiSeries(closes, 14)
        const hist = macdHistSeries(closes, 12, 26, 9)
        const n = bars.length

        // V low = lowest low over the last stretch (the bounce trough).
        let vIdx = n - 12
        for (let i = n - 12; i < n; i++) if (bars[i].low < bars[vIdx].low) vIdx = i

        // Entry sits on the reversal candle that carves the V — as low as the
        // setup allows, so the bounce is captured from the bottom, not chased.
        const eIdx = vIdx
        const entry = closes[eIdx]
        const stop = bars[vIdx].low * 0.995
        const risk = entry - stop
        const current = closes[n - 1] // latest price — the bounce is in progress
        // Target = projected swing-high goal, just above the recent highs so it
        // sits beyond the current price (the planned move isn't complete yet).
        const lowMin = Math.min(...bars.map((b) => b.low))
        const highMax = Math.max(...bars.map((b) => b.high))
        const target = highMax + (highMax - lowMin) * 0.12
        const rr = risk > 0 ? (target - entry) / risk : 0

        // Asymmetric padding: extra room below for the V swoosh + Entry arrow.
        const rawMin = Math.min(lowMin, stop)
        const rawMax = target
        const span = rawMax - rawMin || 1
        const pMin = rawMin - span * 0.12
        const pMax = rawMax + span * 0.05

        // RSI V trough and MACD-histogram V trough (recent).
        let rIdx = n - 12
        for (let i = n - 12; i < n; i++) if (rsi[i] < rsi[rIdx]) rIdx = i
        let hIdx = n - 12
        for (let i = n - 12; i < n; i++) if (hist[i] < hist[hIdx]) hIdx = i
        const hAmp = Math.max(...hist.filter(Number.isFinite).map((v) => Math.abs(v)), 1e-6)

        return { bars, closes, ema, rsi, hist, n, vIdx, eIdx, rIdx, hIdx, entry, current, target, rr, pMin, pMax, hAmp }
    }, [])

    const { bars, ema, rsi, hist, n, vIdx, eIdx, rIdx, hIdx, entry, current, target, rr, pMin, pMax, hAmp } = model
    const cw = (W - PAD_L - PAD_R) / n
    const cx = (i: number) => PAD_L + (i + 0.5) * cw
    const pY = (v: number) => P_TOP + ((pMax - v) / (pMax - pMin)) * (P_BOT - P_TOP)
    const rY = (v: number) => R_TOP + RSI_PAD + ((100 - v) / 100) * (R_BOT - R_TOP - 2 * RSI_PAD)
    const mMid = (M_TOP + M_BOT) / 2
    const mY = (v: number) => mMid - (v / hAmp) * ((M_BOT - M_TOP) / 2) * MACD_SCALE

    const emaPath = ema
        .map((v, i) => (Number.isFinite(v) ? `${cx(i).toFixed(1)},${pY(v).toFixed(1)}` : null))
        .filter(Boolean)
        .join(' ')
    const rsiPath = rsi
        .map((v, i) => (Number.isFinite(v) ? `${cx(i).toFixed(1)},${rY(v).toFixed(1)}` : null))
        .filter(Boolean)
        .join(' ')

    const body = Math.max(1.4, cw * 0.6)
    const labelX = W - PAD_R + 6
    // Trade levels start at the entry bar — they describe the trade *after* entry,
    // not the decline before it (so the entry line never crosses the falling candles).
    const tradeX = cx(eIdx)

    const Line = ({ v, color, label }: { v: number; color: string; label: string }) => (
        <g>
            <line x1={tradeX} x2={W - PAD_R} y1={pY(v)} y2={pY(v)} stroke={color} strokeWidth='1' strokeDasharray='4 3' opacity='0.9' />
            <text x={labelX} y={pY(v) - 2} className='sample__tag' fill={color}>
                {label}
            </text>
            <text x={labelX} y={pY(v) + 9} className='sample__price' fill={color}>
                {v.toFixed(2)}
            </text>
        </g>
    )

    // Gold curved "Entry" arrow sweeping up from the lower-left to the reclaim
    // candle. Positions are clamped so the label never spills out of the pane.
    const ax = cx(eIdx)
    const ay = pY(entry)
    const aStartY = Math.min(ay + 30, P_BOT - 14)
    const aLabelY = Math.min(ay + 42, P_BOT - 3)

    return (
        <svg className='sample' viewBox={`0 0 ${W} ${H}`} role='img' aria-label='V Bounce example chart'>
            {/* panels */}
            <rect x='1' y={P_TOP - 8} width={W - 2} height={P_BOT - P_TOP + 16} rx='8' className='sample__panel' />
            <rect x='1' y={R_TOP - 8} width={W - 2} height={R_BOT - R_TOP + 16} rx='8' className='sample__panel' />
            <rect x='1' y={M_TOP - 8} width={W - 2} height={M_BOT - M_TOP + 16} rx='8' className='sample__panel' />

            {/* captured-move zone: entry → target, from the reclaim onward */}
            <rect
                x={cx(eIdx)}
                y={pY(target)}
                width={W - PAD_R - cx(eIdx)}
                height={pY(entry) - pY(target)}
                fill='var(--long)'
                opacity='0.1'
            />

            {/* target / entry levels */}
            <Line v={target} color='var(--long)' label={t('card.target')} />
            <Line v={entry} color='var(--accent)' label={t('card.entry')} />

            {/* candles */}
            {bars.map((b, i) => {
                const up = b.close >= b.open
                const color = up ? 'var(--long)' : 'var(--short)'
                const yO = pY(b.open)
                const yC = pY(b.close)
                return (
                    <g key={i}>
                        <line x1={cx(i)} x2={cx(i)} y1={pY(b.high)} y2={pY(b.low)} stroke={color} strokeWidth='1' opacity='0.7' />
                        <rect
                            x={cx(i) - body / 2}
                            y={Math.min(yO, yC)}
                            width={body}
                            height={Math.max(1, Math.abs(yC - yO))}
                            fill={color}
                            opacity={up ? 0.9 : 0.8}
                        />
                    </g>
                )
            })}

            {/* EMA10 */}
            <polyline points={emaPath} fill='none' stroke='var(--cyan)' strokeWidth='1.6' />
            <text x={cx(2)} y={pY(ema[16] ?? bars[16].close) - 6} className='sample__legend' fill='var(--cyan)'>
                EMA10
            </text>

            {/* current price guide — spans the chart, with a value pill on the axis */}
            <line x1={PAD_L} x2={W - PAD_R} y1={pY(current)} y2={pY(current)} stroke='var(--text-dim)' strokeWidth='1' strokeDasharray='2 3' opacity='0.7' />
            <rect x={labelX - 4} y={pY(current) - 8} width={PAD_R - 4} height='16' rx='3' fill='var(--text-dim)' opacity='0.2' />
            <text x={labelX} y={pY(current) - 1.5} className='sample__tag' fill='var(--text)'>
                {t('card.now')}
            </text>
            <text x={labelX} y={pY(current) + 8.5} className='sample__price' fill='var(--text)'>
                {current.toFixed(2)}
            </text>

            {/* price V swoosh */}
            <Swoosh x={cx(vIdx)} y={pY(bars[vIdx].low) + 11} color='var(--long)' />

            {/* entry marker at the reclaim + reward:risk */}
            <circle cx={cx(eIdx)} cy={pY(entry)} r='3.6' fill={GOLD} stroke='var(--surface)' strokeWidth='1.6' />
            <text
                x={(cx(eIdx) + (W - PAD_R)) / 2}
                y={(pY(target) + pY(entry)) / 2 + 3}
                className='sample__rr'
                fill='var(--long)'
                textAnchor='middle'
            >
                R:R {rr.toFixed(1)}
            </text>

            {/* gold curved Entry arrow → the reclaim candle */}
            <path
                d={`M${ax - 30},${aStartY} Q${ax - 28},${ay + 12} ${ax - 4},${ay + 7}`}
                fill='none'
                stroke={GOLD}
                strokeWidth='2.2'
                strokeLinecap='round'
            />
            <path d={`M${ax - 4},${ay + 7} l-1,7 M${ax - 4},${ay + 7} l-7,1`} fill='none' stroke={GOLD} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' />
            <text x={ax - 30} y={aLabelY} className='sample__note' fill={GOLD} textAnchor='middle'>
                {t('card.entry')}
            </text>

            {/* RSI panel */}
            <line x1={PAD_L} x2={W - PAD_R} y1={rY(70)} y2={rY(70)} stroke='var(--short)' strokeWidth='0.75' strokeDasharray='3 3' opacity='0.6' />
            <line x1={PAD_L} x2={W - PAD_R} y1={rY(30)} y2={rY(30)} stroke='var(--wait)' strokeWidth='0.75' strokeDasharray='3 3' opacity='0.8' />
            <text x={labelX} y={rY(70) + 3.5} className='sample__tag' fill='var(--text-faint)'>70</text>
            <text x={labelX} y={rY(30) + 3.5} className='sample__tag' fill='var(--text-faint)'>30</text>
            <polyline points={rsiPath} fill='none' stroke='#a78bfa' strokeWidth='1.6' />
            <Swoosh x={cx(rIdx)} y={rY(rsi[rIdx]) + 11} color='#a78bfa' />
            <text x={cx(2)} y={R_TOP + 4} className='sample__legend' fill='#a78bfa'>
                {t('strat.rsiLabel')}
            </text>

            {/* MACD panel */}
            <line x1={PAD_L} x2={W - PAD_R} y1={mMid} y2={mMid} stroke='var(--text-faint)' strokeWidth='0.75' opacity='0.5' />
            {hist.map((v, i) =>
                Number.isFinite(v) ? (
                    <rect
                        key={i}
                        x={cx(i) - body / 2}
                        y={Math.min(mMid, mY(v))}
                        width={body}
                        height={Math.max(0.8, Math.abs(mY(v) - mMid))}
                        fill={v >= 0 ? 'var(--long)' : 'var(--short)'}
                        opacity='0.75'
                    />
                ) : null
            )}
            <Swoosh x={cx(hIdx)} y={mY(hist[hIdx]) + 11} color='#38bdf8' />
            <text x={cx(2)} y={M_TOP + 4} className='sample__legend' fill='#38bdf8'>
                {t('strat.macdLabel')}
            </text>
        </svg>
    )
}
