import { useAssetStream } from '../../hooks/useAssetStream'
import type { Interval } from '../../types'
import { useEffect, useRef, useState } from 'react'
import { useStrategy } from '../../context/StrategyContext'
import { useI18n } from '../../context/I18nContext'
import { useNotifications } from '../../context/NotificationsContext'
import { usePaperTrading } from '../../context/PaperTradingContext'
import { useTradingMode } from '../../context/TradingModeContext'
import { useToast } from '../../context/ToastContext'
import { setPrice } from '../../services/priceStore'
import { planOrder, openPosition as openRealPosition, type OrderPlan } from '../../services/binanceTrade'
import { OrderModal, type OrderStatus } from '../OrderModal/OrderModal'
import { runBacktest } from '../../indicators/backtest'
import { SignalBadge } from '../SignalBadge/SignalBadge'
import { StatusTag } from '../StatusTag/StatusTag'
import { AssetLogo } from '../AssetLogo/AssetLogo'
import { HorizonTag } from '../HorizonTag/HorizonTag'
import { BacktestModal } from '../BacktestModal/BacktestModal'
import { Sparkline } from '../Sparkline/Sparkline'
import { IndicatorGrid } from '../IndicatorGrid/IndicatorGrid'
import { formatPrice, formatPct } from '../../utils/format'
import './AssetCard.scss'

interface AssetCardProps {
    symbol: string
    interval: Interval
    onRemove: (symbol: string) => void
}

const base = (symbol: string) => symbol.replace(/USDT$|BUSD$|USDC$/, '')
const quote = (symbol: string) => symbol.match(/USDT$|BUSD$|USDC$/)?.[0] ?? ''

const PATTERN_KEY: Record<string, string> = {
    'V-bounce': 'pattern.v-bounce',
    'Inverted-V': 'pattern.inverted-v',
    'Fake V (downtrend)': 'pattern.fake-v',
    'Fake Λ (uptrend)': 'pattern.fake-lambda',
    'No setup': 'pattern.no-setup'
}

export const AssetCard = ({ symbol, interval, onRemove }: AssetCardProps) => {
    const { t } = useI18n()
    const { getParams, isCustom, saveParams, clearParams } = useStrategy()
    const { open: openPosition, defaults } = usePaperTrading()
    const { mode, credentials } = useTradingMode()
    const { notify, shouldAlert } = useNotifications()
    const { push: pushToast } = useToast()
    const realMode = mode === 'real' && credentials !== null
    const params = getParams(symbol)
    const asset = useAssetStream(symbol, interval, params)
    const {
        indicators,
        signal,
        status,
        priceDecimals,
        livePrice,
        priceChangePct,
        candles,
        reconnectAttempts
    } = asset

    const [showBacktest, setShowBacktest] = useState(false)
    const [btOverride, setBtOverride] = useState(false)
    const [order, setOrder] = useState<{
        side: 'LONG' | 'SHORT'
        plan: OrderPlan | null
        status: OrderStatus
        error?: string
    } | null>(null)

    const kind = signal?.kind ?? 'WAIT'
    const direction = priceChangePct > 0 ? 'up' : priceChangePct < 0 ? 'down' : 'flat'

    // Background backtest of this strategy on this symbol/timeframe so a signal on
    // a historically losing pair gets flagged. Deferred off the render path;
    // recomputes only when a new bar closes or the tuning params change.
    const lastBarTime = candles.length ? candles[candles.length - 1].openTime : 0
    const paramsSig = JSON.stringify(params)
    const [backtest, setBacktest] = useState<ReturnType<typeof runBacktest> | null>(null)
    useEffect(() => {
        if (candles.length <= 80) {
            setBacktest(null)
            return
        }
        const id = window.setTimeout(() => setBacktest(runBacktest(candles, interval, params)), 0)
        return () => window.clearTimeout(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastBarTime, interval, paramsSig])

    const btVerdict = !backtest
        ? null
        : backtest.total < 6
          ? ({ kind: 'low', n: backtest.total } as const)
          : backtest.totalR > 0 && backtest.profitFactor >= 1
            ? ({ kind: 'pass', r: backtest.totalR, win: backtest.winRate, pf: backtest.profitFactor } as const)
            : ({ kind: 'fail', r: backtest.totalR, win: backtest.winRate, pf: backtest.profitFactor } as const)

    // Hard gate: a failing backtest blocks the trade buttons until overridden.
    const btBlocked = btVerdict?.kind === 'fail' && !btOverride

    // Feed the live price to the shared store so the positions panel can mark PnL.
    useEffect(() => {
        if (livePrice !== null) setPrice(symbol, livePrice)
    }, [symbol, livePrice])

    // Notify on a fresh actionable signal (skip the first observation on mount).
    const lastSignalRef = useRef<string | null>(null)
    useEffect(() => {
        if (!signal) return
        const k = signal.kind
        if (lastSignalRef.current === null) {
            lastSignalRef.current = k
            return
        }
        if (k !== lastSignalRef.current) {
            lastSignalRef.current = k
            if ((k === 'LONG' || k === 'SHORT') && !signal.fake && shouldAlert(symbol, signal.confidence)) {
                notify(t('notif.title', { side: k, sym: base(symbol) }), {
                    body: t('notif.body', {
                        pattern: t(PATTERN_KEY[signal.pattern] ?? 'pattern.no-setup'),
                        conf: signal.confidence,
                        tf: interval
                    }),
                    tag: `${symbol}-${interval}`
                })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signal?.kind, signal?.fake])

    const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

    const openTrade = async (side: 'LONG' | 'SHORT') => {
        const price = livePrice ?? indicators?.price
        if (!price) return
        if (realMode && credentials) {
            try {
                const plan = await planOrder(credentials, symbol, side, defaults.margin, defaults.leverage, defaults.marginType, price)
                setOrder({ side, plan, status: 'confirm' })
            } catch (e) {
                pushToast({ variant: 'error', title: t('toast.failedTitle'), message: errMsg(e) })
            }
            return
        }
        openPosition({ symbol, base: base(symbol), side, price, decimals: priceDecimals ?? 2, interval })
    }

    // Place the real order from the confirm modal, then report via a banner toast.
    const confirmOrder = async () => {
        if (!order?.plan || !credentials) return
        setOrder((o) => (o ? { ...o, status: 'placing' } : o))
        try {
            await openRealPosition(credentials, order.plan)
            setOrder(null)
            pushToast({
                variant: 'success',
                title: t('toast.openedTitle'),
                message: t('toast.openedMsg', {
                    side: t(order.side === 'LONG' ? 'card.long' : 'card.short'),
                    sym: symbol,
                    qty: String(order.plan.quantity),
                    lev: defaults.leverage
                })
            })
        } catch (e) {
            setOrder(null)
            pushToast({ variant: 'error', title: t('toast.failedTitle'), message: errMsg(e) })
        }
    }

    return (
        <article className={`asset-card asset-card--${kind.toLowerCase()}`}>
            <header className='asset-card__head'>
                <div className='asset-card__id'>
                    <AssetLogo symbol={base(symbol)} size={36} />
                    <h2 className='asset-card__symbol'>
                        {base(symbol)}
                        <span className='asset-card__quote'>{quote(symbol)}</span>
                    </h2>
                    <span className='asset-card__tf'>{interval}</span>
                </div>
                <div className='asset-card__head-right'>
                    <StatusTag status={status} reconnectAttempts={reconnectAttempts} />
                    <a
                        className='asset-card__binance'
                        href={`https://www.binance.com/en/futures/${symbol}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label={`Open ${symbol} on Binance Futures`}
                        title='Open on Binance Futures'
                    >
                        ↗
                    </a>
                    <button
                        className='asset-card__remove'
                        onClick={() => onRemove(symbol)}
                        aria-label={`Remove ${symbol}`}
                        title='Remove'
                    >
                        ✕
                    </button>
                </div>
            </header>

            <div className='asset-card__price-row'>
                <div className='asset-card__price'>
                    {livePrice !== null
                        ? formatPrice(livePrice, priceDecimals)
                        : indicators
                          ? formatPrice(indicators.price, priceDecimals)
                          : '—'}
                </div>
                <span className={`asset-card__change asset-card__change--${direction}`}>
                    {formatPct(priceChangePct)}
                </span>
            </div>

            <div className='asset-card__spark'>
                <Sparkline
                    candles={candles}
                    direction={direction}
                    support={indicators?.support}
                    resistance={indicators?.resistance}
                />
            </div>

            {!indicators && status === 'error' ? (
                <div className='asset-card__loading asset-card__loading--error'>{t('card.error')}</div>
            ) : !indicators && status === 'offline' ? (
                <div className='asset-card__loading'>{t('card.offlineWait')}</div>
            ) : !indicators ? (
                <div className='asset-card__loading'>{t('card.connecting')}</div>
            ) : (
                <>
                    <div className='asset-card__signal'>
                        <div className='asset-card__signal-left'>
                            <SignalBadge signal={signal} size='lg' />
                            {signal && (
                                <span className={`asset-card__pattern ${signal.fake ? 'is-fake' : ''}`}>
                                    {t(PATTERN_KEY[signal.pattern] ?? 'pattern.no-setup')}
                                </span>
                            )}
                        </div>
                        <div className='asset-card__trend'>
                            <span className='asset-card__trend-label'>{t('card.trend')}</span>
                            <span className={`asset-card__trend-val is-${indicators.trend}`}>
                                {t(`trend.${indicators.trend}`)}
                            </span>
                        </div>
                    </div>

                    {signal?.fake && (
                        <div className='asset-card__fake'>
                            {signal.pattern.includes('Λ') ? t('card.fakeUptrend') : t('card.fakeDowntrend')}
                        </div>
                    )}

                    <HorizonTag
                        interval={interval}
                        lastOpenTime={candles.length ? candles[candles.length - 1].openTime : null}
                        signal={signal?.kind ?? 'WAIT'}
                    />

                    <IndicatorGrid indicators={indicators} priceDecimals={priceDecimals} />

                    <div className='asset-card__levels'>
                        <div className='asset-card__level asset-card__level--res'>
                            <span>{t('card.resistance')}</span>
                            <b>{formatPrice(indicators.resistance, priceDecimals)}</b>
                        </div>
                        <div className='asset-card__level asset-card__level--sup'>
                            <span>{t('card.support')}</span>
                            <b>{formatPrice(indicators.support, priceDecimals)}</b>
                        </div>
                    </div>

                    {signal && signal.kind !== 'WAIT' && signal.entry && (
                        <div className='asset-card__plan'>
                            <div className='asset-card__plan-head'>
                                <span className='asset-card__plan-basis'>
                                    {signal.planBasis ?? 'Dynamic levels'}
                                </span>
                                {signal.riskReward !== null && (
                                    <span
                                        className={`asset-card__rr ${signal.riskReward >= 1.5 ? 'is-good' : signal.riskReward < 1 ? 'is-poor' : ''}`}
                                    >
                                        R:R {signal.riskReward.toFixed(2)}
                                    </span>
                                )}
                            </div>
                            <div className='asset-card__trade'>
                                <div className='asset-card__trade-cell'>
                                    <span>{t('card.entry')}</span>
                                    <b>{formatPrice(signal.entry, priceDecimals)}</b>
                                </div>
                                <div className='asset-card__trade-cell is-loss'>
                                    <span>{t('card.stop')}</span>
                                    <b>{formatPrice(signal.stopLoss, priceDecimals)}</b>
                                </div>
                                <div className='asset-card__trade-cell is-profit'>
                                    <span>{t('card.target')}</span>
                                    <b>{formatPrice(signal.takeProfit, priceDecimals)}</b>
                                </div>
                            </div>
                        </div>
                    )}

                    {signal && signal.reasons.length > 0 && (
                        <ul className='asset-card__reasons'>
                            {signal.reasons.slice(0, 4).map((r) => (
                                <li key={r.label} className={`asset-card__reason is-${r.direction}`}>
                                    <span className='asset-card__reason-dot' />
                                    {r.label}
                                </li>
                            ))}
                        </ul>
                    )}

                    {btVerdict && (
                        <div className={`asset-card__bt asset-card__bt--${btVerdict.kind}`}>
                            <span className='asset-card__bt-icon'>
                                {btVerdict.kind === 'fail' ? '⚠' : btVerdict.kind === 'pass' ? '✓' : '📉'}
                            </span>
                            <span>
                                {btVerdict.kind === 'low'
                                    ? t('card.btLow', { n: btVerdict.n })
                                    : btVerdict.kind === 'pass'
                                      ? t('card.btPass', {
                                            r: `+${btVerdict.r.toFixed(1)}`,
                                            win: Math.round(btVerdict.win),
                                            pf: btVerdict.pf === Infinity ? '∞' : btVerdict.pf.toFixed(2)
                                        })
                                      : t('card.btFail', {
                                            r: btVerdict.r.toFixed(1),
                                            win: Math.round(btVerdict.win),
                                            pf: btVerdict.pf.toFixed(2)
                                        })}
                            </span>
                            {btVerdict.kind === 'fail' && !btOverride && (
                                <button className='asset-card__bt-override' onClick={() => setBtOverride(true)}>
                                    {t('card.btTradeAnyway')}
                                </button>
                            )}
                        </div>
                    )}

                    <div className={`asset-card__paper ${realMode ? 'is-real' : ''}`}>
                        <span className='asset-card__paper-label'>
                            {realMode ? `⚡ ${t('card.real')}` : t('card.paper')} · {defaults.margin} USDT · {defaults.leverage}x
                        </span>
                        <div className='asset-card__paper-btns'>
                            <button className='asset-card__paper-btn is-long' onClick={() => openTrade('LONG')} disabled={btBlocked}>
                                ▲ {t('card.long')}
                            </button>
                            <button className='asset-card__paper-btn is-short' onClick={() => openTrade('SHORT')} disabled={btBlocked}>
                                ▼ {t('card.short')}
                            </button>
                        </div>
                    </div>

                    <button className='asset-card__backtest' onClick={() => setShowBacktest(true)}>
                        📊 {t('card.backtest')}
                        {isCustom(symbol) && <span className='asset-card__tuned'>{t('card.tuned')}</span>}
                    </button>
                </>
            )}

            {order && credentials && (
                <OrderModal
                    side={order.side}
                    symbol={symbol}
                    plan={order.plan}
                    testnet={credentials.testnet}
                    status={order.status}
                    error={order.error}
                    warning={
                        btVerdict?.kind === 'fail'
                            ? t('order.btWarn', {
                                  r: btVerdict.r.toFixed(1),
                                  win: Math.round(btVerdict.win),
                                  pf: btVerdict.pf.toFixed(2)
                              })
                            : undefined
                    }
                    onConfirm={confirmOrder}
                    onClose={() => setOrder(null)}
                />
            )}

            {showBacktest && (
                <BacktestModal
                    symbol={symbol}
                    interval={interval}
                    savedParams={params}
                    isCustom={isCustom(symbol)}
                    onApply={(p) => saveParams(symbol, p)}
                    onClear={() => clearParams(symbol)}
                    onClose={() => setShowBacktest(false)}
                />
            )}
        </article>
    )
}
