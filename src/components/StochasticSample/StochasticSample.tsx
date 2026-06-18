import { useMemo } from 'react'
import { emaSeries } from '../../indicators/ema'
import { useI18n } from '../../context/I18nContext'
import { mulberry32, toBars, Candles, type Bar } from '../SampleChart/sampleKit'
import '../SampleChart/SampleChart.scss'

const W = 640
const P_TOP = 22
const P_BOT = 248
const S_TOP = 274
const S_BOT = 372
const H = 392
const PAD_L = 14
const PAD_R = 70
const GOLD = '#f0b429'
const PERIOD = 14
const OB = 80
const OS = 20

// Uptrend → a pullback that pushes Stochastic into oversold → the %K/%D cross up.
const build = (): Bar[] => {
    const rnd = mulberry32(17)
    const closes: number[] = []
    let p = 96
    for (let i = 0; i < 24; i++) {
        p += 0.42 + (rnd() - 0.5) * 0.7
        closes.push(p)
    }
    for (let i = 0; i < 6; i++) {
        p += -0.95 + (rnd() - 0.5) * 0.4
        closes.push(p)
    }
    for (let i = 0; i < 13; i++) {
        p += 0.66 + (rnd() - 0.5) * 0.5
        closes.push(p)
    }
    return toBars(closes, 5)
}

// %K (slow) and %D series aligned to bar indices (NaN until ready).
const stochSeries = (bars: Bar[]) => {
    const n = bars.length
    const rawK = new Array<number>(n).fill(NaN)
    for (let i = PERIOD - 1; i < n; i++) {
        const win = bars.slice(i - PERIOD + 1, i + 1)
        const hh = Math.max(...win.map((b) => b.high))
        const ll = Math.min(...win.map((b) => b.low))
        rawK[i] = hh - ll > 0 ? (100 * (bars[i].close - ll)) / (hh - ll) : 50
    }
    const sm = (arr: number[], i: number, len: number) => {
        let s = 0
        for (let j = i - len + 1; j <= i; j++) s += arr[j]
        return s / len
    }
    const k = new Array<number>(n).fill(NaN)
    for (let i = PERIOD + 1; i < n; i++) k[i] = sm(rawK, i, 3)
    const d = new Array<number>(n).fill(NaN)
    for (let i = PERIOD + 3; i < n; i++) d[i] = sm(k, i, 3)
    return { k, d }
}

export const StochasticSample = () => {
    const { t } = useI18n()
    const model = useMemo(() => {
        const bars = build()
        const closes = bars.map((b) => b.close)
        const n = bars.length
        const e55 = emaSeries(closes, 55)
        const { k, d } = stochSeries(bars)

        // Entry = the bullish %K/%D cross after the dip.
        let entryIdx = n - 1
        for (let i = 26; i < n; i++) {
            if (Number.isFinite(k[i]) && Number.isFinite(d[i]) && k[i - 1] <= d[i - 1] && k[i] > d[i]) {
                entryIdx = i
                break
            }
        }
        const entry = closes[entryIdx]
        const stop = Math.min(...bars.slice(entryIdx - 6, entryIdx + 1).map((b) => b.low)) * 0.995
        const highMax = Math.max(...bars.map((b) => b.high))
        const lowMin = Math.min(...bars.map((b) => b.low))
        const target = highMax + (highMax - lowMin) * 0.08
        const current = closes[n - 1]
        const rr = entry - stop > 0 ? (target - entry) / (entry - stop) : 0
        const rawMin = Math.min(stop, lowMin, ...e55.filter(Number.isFinite))
        const rawMax = Math.max(target, highMax)
        const span = rawMax - rawMin || 1
        return { bars, e55, k, d, n, entryIdx, entry, target, current, rr, pMin: rawMin - span * 0.06, pMax: rawMax + span * 0.06 }
    }, [])

    const { bars, e55, k, d, n, entryIdx, entry, target, current, rr, pMin, pMax } = model
    const cw = (W - PAD_L - PAD_R) / n
    const cx = (i: number) => PAD_L + (i + 0.5) * cw
    const pY = (v: number) => P_TOP + ((pMax - v) / (pMax - pMin)) * (P_BOT - P_TOP)
    const sY = (v: number) => S_TOP + ((100 - v) / 100) * (S_BOT - S_TOP)
    const body = Math.max(1.4, cw * 0.6)
    const labelX = W - PAD_R + 6
    const tradeX = cx(entryIdx)

    const ePath = e55.map((v, i) => (Number.isFinite(v) ? `${cx(i).toFixed(1)},${pY(v).toFixed(1)}` : null)).filter(Boolean).join(' ')
    const line = (arr: number[]) =>
        arr.map((v, i) => (Number.isFinite(v) ? `${cx(i).toFixed(1)},${sY(v).toFixed(1)}` : null)).filter(Boolean).join(' ')

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

    return (
        <svg className='sample' viewBox={`0 0 ${W} ${H}`} role='img' aria-label='Stochastic example chart'>
            <rect x='1' y={P_TOP - 8} width={W - 2} height={P_BOT - P_TOP + 16} rx='8' className='sample__panel' />
            <rect x='1' y={S_TOP - 8} width={W - 2} height={S_BOT - S_TOP + 16} rx='8' className='sample__panel' />

            <rect x={cx(entryIdx)} y={pY(target)} width={W - PAD_R - cx(entryIdx)} height={pY(entry) - pY(target)} fill='var(--long)' opacity='0.1' />
            <Line v={target} color='var(--long)' label={t('card.target')} />
            <Line v={entry} color='var(--accent)' label={t('card.entry')} />

            <Candles bars={bars} cx={cx} pY={pY} body={body} />
            <polyline points={ePath} fill='none' stroke='var(--cyan)' strokeWidth='1.6' />
            <text x={cx(2)} y={pY(e55[24] ?? bars[24].close) + 14} className='sample__legend' fill='var(--cyan)'>
                EMA55
            </text>

            <line x1={PAD_L} x2={W - PAD_R} y1={pY(current)} y2={pY(current)} stroke='var(--text-dim)' strokeWidth='1' strokeDasharray='2 3' opacity='0.7' />
            <text x={labelX} y={pY(current) - 1.5} className='sample__tag' fill='var(--text)'>
                {t('card.now')}
            </text>
            <text x={labelX} y={pY(current) + 8.5} className='sample__price' fill='var(--text)'>
                {current.toFixed(2)}
            </text>

            <circle cx={cx(entryIdx)} cy={pY(entry)} r='3.6' fill={GOLD} stroke='var(--surface)' strokeWidth='1.6' />
            <text x={(cx(entryIdx) + (W - PAD_R)) / 2} y={(pY(target) + pY(entry)) / 2 + 3} className='sample__rr' fill='var(--long)' textAnchor='middle'>
                R:R {rr.toFixed(1)}
            </text>

            {/* stochastic pane */}
            <line x1={PAD_L} x2={W - PAD_R} y1={sY(OB)} y2={sY(OB)} stroke='var(--short)' strokeWidth='0.75' strokeDasharray='3 3' opacity='0.6' />
            <line x1={PAD_L} x2={W - PAD_R} y1={sY(OS)} y2={sY(OS)} stroke='var(--long)' strokeWidth='0.75' strokeDasharray='3 3' opacity='0.7' />
            <text x={labelX} y={sY(OB) + 3.5} className='sample__tag' fill='var(--text-faint)'>80</text>
            <text x={labelX} y={sY(OS) + 3.5} className='sample__tag' fill='var(--text-faint)'>20</text>
            <polyline points={line(k)} fill='none' stroke='var(--accent)' strokeWidth='1.5' />
            <polyline points={line(d)} fill='none' stroke='#f0b429' strokeWidth='1.3' opacity='0.85' />
            <circle cx={cx(entryIdx)} cy={sY(k[entryIdx])} r='3' fill='none' stroke='var(--long)' strokeWidth='1.6' />
            <text x={cx(2)} y={S_TOP + 4} className='sample__legend' fill='var(--accent)'>
                Stochastic %K · %D
            </text>
        </svg>
    )
}
