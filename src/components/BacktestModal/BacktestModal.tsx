import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Candle, Interval } from '../../types'
import { fetchKlinesResilient } from '../../services/binanceRest'
import { precomputeBars, runBacktestOn } from '../../indicators/backtest'
import { optimize } from '../../indicators/optimize'
import { DEFAULT_PARAMS, type StrategyParams } from '../../indicators/params'
import { formatNumber } from '../../utils/format'
import { useI18n } from '../../context/I18nContext'
import './BacktestModal.scss'

interface BacktestModalProps {
    symbol: string
    interval: Interval
    savedParams: StrategyParams
    isCustom: boolean
    onApply: (params: StrategyParams) => void
    onClear: () => void
    onClose: () => void
}

const HISTORY_BARS = 1000

const EquityCurve = ({ equity }: { equity: number[] }) => {
    const { path, area, zeroY, up } = useMemo(() => {
        if (equity.length < 2) return { path: '', area: '', zeroY: 0, up: true }
        const w = 100
        const h = 40
        const min = Math.min(0, ...equity)
        const max = Math.max(0, ...equity)
        const span = max - min || 1
        const x = (i: number) => (i / (equity.length - 1)) * w
        const y = (v: number) => h - ((v - min) / span) * h
        const pts = equity.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`)
        return {
            path: `M${pts.join(' L')}`,
            area: `M${pts.join(' L')} L${w},${h} L0,${h} Z`,
            zeroY: y(0),
            up: equity[equity.length - 1] >= 0
        }
    }, [equity])

    if (!path) return <div className='backtest__curve backtest__curve--empty'>No trades</div>
    const color = up ? 'var(--long)' : 'var(--short)'

    return (
        <svg className='backtest__curve' viewBox='0 0 100 40' preserveAspectRatio='none'>
            <defs>
                <linearGradient id='eq-grad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={color} stopOpacity='0.3' />
                    <stop offset='100%' stopColor={color} stopOpacity='0' />
                </linearGradient>
            </defs>
            <line x1='0' x2='100' y1={zeroY} y2={zeroY} stroke='var(--border-strong)' strokeWidth='0.5' strokeDasharray='2 2' />
            <path d={area} fill='url(#eq-grad)' />
            <path d={path} fill='none' stroke={color} strokeWidth='1.5' vectorEffect='non-scaling-stroke' />
        </svg>
    )
}

interface SliderProps {
    label: string
    value: number
    min: number
    max: number
    step: number
    display: string
    disabled?: boolean
    onChange: (v: number) => void
}

const Slider = ({ label, value, min, max, step, display, disabled, onChange }: SliderProps) => (
    <label className='backtest__slider'>
        <span className='backtest__slider-top'>
            <span>{label}</span>
            <b>{display}</b>
        </span>
        <input
            type='range'
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
        />
    </label>
)

const Stat = ({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) => (
    <div className='backtest__stat'>
        <span className='backtest__stat-label'>{label}</span>
        <span className={`backtest__stat-value ${cls ?? ''}`}>{value}</span>
        {sub && <span className='backtest__stat-sub'>{sub}</span>}
    </div>
)

const same = (a: StrategyParams, b: StrategyParams) => JSON.stringify(a) === JSON.stringify(b)

export const BacktestModal = ({
    symbol,
    interval,
    savedParams,
    isCustom,
    onApply,
    onClear,
    onClose
}: BacktestModalProps) => {
    const { t } = useI18n()
    const [candles, setCandles] = useState<Candle[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [params, setParams] = useState<StrategyParams>(savedParams)
    const [applied, setApplied] = useState<StrategyParams>(savedParams)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

    useEffect(() => {
        let active = true
        fetchKlinesResilient(symbol, interval, HISTORY_BARS)
            .then((data) => active && setCandles(data))
            .catch(() => active && setError(t('bt.errLoad')))
        return () => {
            active = false
        }
    }, [symbol, interval])

    // Heavy, param-independent step — done once and reused by every re-run.
    const bars = useMemo(() => (candles ? precomputeBars(candles) : null), [candles])

    useEffect(() => {
        const t = setTimeout(() => setApplied(params), 160)
        return () => clearTimeout(t)
    }, [params])

    const result = useMemo(
        () => (bars && candles ? runBacktestOn(bars, candles, interval, applied) : null),
        [bars, candles, interval, applied]
    )

    const set = (patch: Partial<StrategyParams>) => setParams((p) => ({ ...p, ...patch }))
    const isDefault = same(params, DEFAULT_PARAMS)
    const dirty = !same(params, savedParams)
    const autoHold = Math.max(12, { '1m': 20, '5m': 20, '15m': 20, '1h': 20, '4h': 16 }[interval])

    const runOptimize = async () => {
        if (!bars || !candles || progress) return
        setProgress({ done: 0, total: 1 })
        const best = await optimize(bars, candles, interval, (done, total) => setProgress({ done, total }))
        setProgress(null)
        if (best) setParams(best.params)
    }

    const pf = result
        ? result.profitFactor === Infinity
            ? '∞'
            : formatNumber(result.profitFactor, 2)
        : '—'
    const rClass = (v: number) => (v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : '')

    return createPortal(
        <div className='backtest' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='backtest__panel' onClick={(e) => e.stopPropagation()}>
                <header className='backtest__head'>
                    <div>
                        <h3>{t('bt.title')}</h3>
                        <p>
                            {symbol.replace(/USDT$|BUSD$|USDC$/, '')} · {interval} · V Bounce
                        </p>
                    </div>
                    <button className='backtest__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                </header>

                {error ? (
                    <div className='backtest__state backtest__state--error'>{error}</div>
                ) : !result ? (
                    <div className='backtest__state'>{t('bt.loading', { bars: HISTORY_BARS })}</div>
                ) : (
                    <>
                        {result.total === 0 ? (
                            <div className='backtest__state'>{t('bt.noSignals', { bars: result.barsTested })}</div>
                        ) : (
                            <>
                                <div className='backtest__curve-wrap'>
                                    <EquityCurve equity={result.equity} />
                                    <span className={`backtest__total ${rClass(result.totalR)}`}>
                                        {result.totalR >= 0 ? '+' : ''}
                                        {formatNumber(result.totalR, 1)}R
                                    </span>
                                </div>

                                <div className='backtest__grid'>
                                    <Stat label={t('bt.trades')} value={`${result.total}`} sub={`${result.longCount}L · ${result.shortCount}S`} />
                                    <Stat label={t('bt.winRate')} value={`${formatNumber(result.winRate, 0)}%`} sub={`${result.wins}W · ${result.losses}L`} cls={result.winRate >= 50 ? 'is-pos' : ''} />
                                    <Stat label={t('bt.avgTrade')} value={`${result.avgR >= 0 ? '+' : ''}${formatNumber(result.avgR, 2)}R`} cls={rClass(result.avgR)} />
                                    <Stat label={t('bt.pf')} value={pf} cls={result.profitFactor >= 1 ? 'is-pos' : 'is-neg'} />
                                    <Stat label={t('bt.maxDd')} value={`-${formatNumber(result.maxDrawdownR, 1)}R`} cls='is-neg' />
                                    <Stat label={t('bt.expectancy')} value={`${result.expectancy >= 0 ? '+' : ''}${formatNumber(result.expectancy, 2)}R`} cls={rClass(result.expectancy)} />
                                </div>
                            </>
                        )}

                        <div className='backtest__actions'>
                            <button className='backtest__optimize' onClick={runOptimize} disabled={!!progress}>
                                {progress ? t('bt.optimizing', { done: progress.done, total: progress.total }) : t('bt.optimize')}
                            </button>
                            <button className='backtest__apply' onClick={() => onApply(params)} disabled={!dirty}>
                                {dirty ? t('bt.apply') : isCustom ? t('bt.applied') : t('bt.usingDefaults')}
                            </button>
                        </div>

                        <div className='backtest__controls'>
                            <div className='backtest__controls-head'>
                                <span>{t('bt.settings')}{isCustom && !dirty ? t('bt.live') : ''}</span>
                                <span className='backtest__controls-links'>
                                    {isCustom && (
                                        <button className='backtest__reset' onClick={onClear}>
                                            {t('bt.clear')}
                                        </button>
                                    )}
                                    {!isDefault && (
                                        <button className='backtest__reset' onClick={() => setParams(DEFAULT_PARAMS)}>
                                            {t('bt.defaults')}
                                        </button>
                                    )}
                                </span>
                            </div>
                            <Slider label={t('bt.rsiExtreme')} value={params.rsiOversold} min={20} max={45} step={1} disabled={!!progress} display={`≤ ${params.rsiOversold} / ≥ ${100 - params.rsiOversold}`} onChange={(v) => set({ rsiOversold: v, rsiOverbought: 100 - v })} />
                            <Slider label={t('bt.downPower')} value={params.fakeSlope} min={0.05} max={0.3} step={0.01} disabled={!!progress} display={`${formatNumber(params.fakeSlope, 2)} ATR/bar`} onChange={(v) => set({ fakeSlope: v })} />
                            <Slider label={t('bt.capVol')} value={params.climaxVol} min={1.5} max={4} step={0.1} disabled={!!progress} display={`≥ ${formatNumber(params.climaxVol, 1)}×`} onChange={(v) => set({ climaxVol: v })} />
                            <Slider label={t('bt.stopCushion')} value={params.stopCushionAtr} min={0} max={1} step={0.05} disabled={!!progress} display={`${formatNumber(params.stopCushionAtr, 2)} ATR`} onChange={(v) => set({ stopCushionAtr: v })} />
                            <Slider label={t('bt.maxHold')} value={params.holdBars} min={0} max={40} step={1} disabled={!!progress} display={params.holdBars === 0 ? t('bt.auto', { n: autoHold }) : t('bt.bars', { n: params.holdBars })} onChange={(v) => set({ holdBars: v })} />
                        </div>

                        <p className='backtest__note'>{t('bt.note')}</p>
                    </>
                )}
            </div>
        </div>,
        document.body
    )
}
