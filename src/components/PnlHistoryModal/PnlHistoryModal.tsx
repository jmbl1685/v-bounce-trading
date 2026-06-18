import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../context/I18nContext'
import { useDisplayCurrency } from '../../context/DisplayCurrencyContext'
import { formatUsd, formatCompact } from '../../utils/format'
import './PnlHistoryModal.scss'

export interface PnlPoint {
    pnl: number
    closedAt: number
}

interface PnlHistoryModalProps {
    closed: PnlPoint[]
    onClose: () => void
}

type View = 'calendar' | 'chart'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const dayKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`
const keyOf = (ts: number) => {
    const d = new Date(ts)
    return dayKey(d.getFullYear(), d.getMonth(), d.getDate())
}

export const PnlHistoryModal = ({ closed, onClose }: PnlHistoryModalProps) => {
    const { t } = useI18n()
    const { conv, unit } = useDisplayCurrency()
    const [view, setView] = useState<View>('calendar')
    const today = new Date()
    const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })

    // Net PnL per calendar day.
    const daily = useMemo(() => {
        const map = new Map<string, number>()
        for (const c of closed) map.set(keyOf(c.closedAt), (map.get(keyOf(c.closedAt)) ?? 0) + c.pnl)
        return map
    }, [closed])

    // Signed money string with the active display unit.
    const money = (v: number, withUnit = false) => {
        const c = conv(v)
        const digits = unit !== 'USDT' && Math.abs(c) >= 1000 ? 0 : 2
        const body = `${c >= 0 ? '+' : ''}${formatUsd(c, digits)}`
        return withUnit ? `${body} ${unit}` : body
    }
    // Compact value for the small calendar cells.
    const cell = (v: number) => {
        const c = conv(v)
        const s = c > 0 ? '+' : ''
        return Math.abs(c) >= 1000 ? `${s}${formatCompact(c)}` : `${s}${c.toFixed(2)}`
    }
    const tone = (v: number) => (v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : 'is-zero')

    // ---- calendar model ------------------------------------------------------
    const monthLabel = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
    const firstWeekday = new Date(ym.y, ym.m, 1).getDay()
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
    const monthTotal = useMemo(() => {
        let s = 0
        for (let d = 1; d <= daysInMonth; d++) s += daily.get(dayKey(ym.y, ym.m, d)) ?? 0
        return s
    }, [daily, ym, daysInMonth])
    const shiftMonth = (delta: number) => {
        const d = new Date(ym.y, ym.m + delta, 1)
        setYm({ y: d.getFullYear(), m: d.getMonth() })
    }

    // ---- chart model: net PnL for each of the last 30 days --------------------
    const series = useMemo(() => {
        const out: { date: Date; pnl: number }[] = []
        const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        for (let i = 29; i >= 0; i--) {
            const d = new Date(base)
            d.setDate(base.getDate() - i)
            out.push({ date: d, pnl: daily.get(dayKey(d.getFullYear(), d.getMonth(), d.getDate())) ?? 0 })
        }
        return out
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [daily])
    const rangeTotal = useMemo(() => series.reduce((s, p) => s + p.pnl, 0), [series])
    const total = view === 'calendar' ? monthTotal : rangeTotal

    const chart = useMemo(() => {
        const vals = series.map((p) => conv(p.pnl))
        const w = 100
        const h = 42
        const min = Math.min(0, ...vals)
        const max = Math.max(0, ...vals)
        const span = max - min || 1
        const x = (i: number) => (i / (vals.length - 1)) * w
        const y = (v: number) => h - ((v - min) / span) * h
        const pts = vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`)
        return { path: `M${pts.join(' L')}`, zeroY: y(0), max, min }
    }, [series, conv])

    const fmtAxis = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    return createPortal(
        <div className='pnlh' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='pnlh__panel' onClick={(e) => e.stopPropagation()}>
                <header className='pnlh__head'>
                    <div>
                        <h3>{t('pnlh.title')}</h3>
                        <p>{closed.length === 0 ? t('pnlh.empty') : t('pnlh.trades', { n: closed.length })}</p>
                    </div>
                    <div className='pnlh__views'>
                        <button
                            className={view === 'chart' ? 'is-active' : ''}
                            onClick={() => setView('chart')}
                            aria-label={t('pnlh.chartView')}
                            title={t('pnlh.chartView')}
                        >
                            📊
                        </button>
                        <button
                            className={view === 'calendar' ? 'is-active' : ''}
                            onClick={() => setView('calendar')}
                            aria-label={t('pnlh.calendarView')}
                            title={t('pnlh.calendarView')}
                        >
                            🗓
                        </button>
                        <button className='pnlh__close' onClick={onClose} aria-label='Close'>
                            ✕
                        </button>
                    </div>
                </header>

                <div className='pnlh__total'>
                    <span className='pnlh__total-label'>{view === 'calendar' ? t('pnlh.monthPnl') : t('pnlh.rangePnl')}</span>
                    <b className={tone(total)}>{money(total, true)}</b>
                </div>

                {view === 'calendar' ? (
                    <div className='pnlh__calendar'>
                        <div className='pnlh__monthnav'>
                            <button onClick={() => shiftMonth(-1)} aria-label='Previous month'>
                                ‹
                            </button>
                            <span>{monthLabel}</span>
                            <button onClick={() => shiftMonth(1)} aria-label='Next month'>
                                ›
                            </button>
                        </div>
                        <div className='pnlh__grid'>
                            {WEEKDAYS.map((d, i) => (
                                <span key={i} className='pnlh__dow'>
                                    {d}
                                </span>
                            ))}
                            {Array.from({ length: firstWeekday }).map((_, i) => (
                                <span key={`b${i}`} className='pnlh__blank' />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const d = i + 1
                                const v = daily.get(dayKey(ym.y, ym.m, d))
                                return (
                                    <div key={d} className={`pnlh__day ${v === undefined ? 'is-empty' : tone(v)}`}>
                                        <span className='pnlh__day-n'>{d}</span>
                                        {v !== undefined && <span className='pnlh__day-v'>{cell(v)}</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className='pnlh__chartwrap'>
                        {closed.length === 0 ? (
                            <div className='pnlh__chart-empty'>{t('pnlh.empty')}</div>
                        ) : (
                            <>
                                <div className='pnlh__chart-y'>
                                    <span>{cell(chart.max)}</span>
                                    <span>0</span>
                                </div>
                                <svg className='pnlh__chart' viewBox='0 0 100 42' preserveAspectRatio='none'>
                                    <line
                                        x1='0'
                                        x2='100'
                                        y1={chart.zeroY}
                                        y2={chart.zeroY}
                                        stroke='var(--border-strong)'
                                        strokeWidth='0.5'
                                        strokeDasharray='2 2'
                                    />
                                    <path
                                        d={chart.path}
                                        fill='none'
                                        stroke='var(--accent)'
                                        strokeWidth='1.5'
                                        vectorEffect='non-scaling-stroke'
                                    />
                                </svg>
                                <div className='pnlh__chart-x'>
                                    <span>{fmtAxis(series[0].date)}</span>
                                    <span>{fmtAxis(series[series.length - 1].date)}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
