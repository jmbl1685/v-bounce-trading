import { useEffect, useRef, useState } from 'react'
import {
    usePaperTrading,
    liqPrice,
    netPnl,
    closeFee,
    fundingCost,
    feeRateOf,
    FUNDING_RATE,
    type Position
} from '../../context/PaperTradingContext'
import { useTradingMode } from '../../context/TradingModeContext'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { useNow } from '../../hooks/useNow'
import { useRealAccount } from '../../hooks/useRealAccount'
import { getPrice } from '../../services/priceStore'
import { closePosition as realClose, type Credentials, type RealPosition } from '../../services/binanceTrade'
import { getLocalTpSl, setLocalTpSl, clearLocalTpSl, localTpSlSymbols } from '../../services/realTpSl'
import { AssetLogo } from '../AssetLogo/AssetLogo'
import { CredentialsModal } from '../CredentialsModal/CredentialsModal'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { formatPrice, formatUsd } from '../../utils/format'
import './PositionsPanel.scss'

interface PositionsPanelProps {
    open: boolean
    onClose: () => void
}

const LEVERAGES = [3, 5, 10, 20, 50]
const REASON: Record<string, string> = { manual: '', tp: 'TP', sl: 'SL', liq: 'LIQ' }

const usdt = (v: number) => `${v >= 0 ? '+' : ''}${formatUsd(v, 2)}`
const pnlCls = (v: number) => (v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : '')
const parseNum = (v: string): number | null => {
    const n = parseFloat(v)
    return Number.isFinite(n) && n > 0 ? n : null
}

export const PositionsPanel = ({ open, onClose }: PositionsPanelProps) => {
    const { t } = useI18n()
    const { account, positions, closed, defaults, startBalance, close, setTpSl, setDefaults, setStartBalance, reset } =
        usePaperTrading()
    const { mode, credentials, hasCredentials, setMode } = useTradingMode()
    const real = mode === 'real' && hasCredentials
    const liveAccount = useRealAccount(real, credentials)
    const now = useNow(800)
    const [showHistory, setShowHistory] = useState(false)
    const [showKeys, setShowKeys] = useState(false)
    const [bankroll, setBankroll] = useState(String(startBalance))
    useEffect(() => setBankroll(String(startBalance)), [startBalance])

    // ---- demo (paper) auto-close on liq / TP / SL ---------------------------
    useDemoAutoClose(real, positions, close, now)

    // ---- real: app-managed TP/SL (market-close when the level is hit) --------
    useRealTpSlGuard(real ? credentials : null, liveAccount.positions, liveAccount.refresh)

    let upnl = 0
    let usedMargin = 0
    const rows = positions.map((p) => {
        const price = getPrice(p.symbol) ?? p.entryPrice
        const net = netPnl(p, price, now)
        upnl += net
        usedMargin += p.margin
        return { p, price, net, roe: (net / p.margin) * 100, liq: liqPrice(p), fees: p.openFee + closeFee(p, price), funding: fundingCost(p, now) }
    })
    const equity = account.balance + usedMargin + upnl
    const realUpnl = liveAccount.positions.reduce((s, p) => s + p.pnl, 0)

    return (
        <aside className={`positions-panel ${open ? 'is-open' : ''} ${real ? 'is-real' : ''}`} aria-hidden={!open}>
            <header className='positions-panel__head'>
                <div>
                    <h3>{t('pt.title')}</h3>
                    <p>{real ? (credentials?.testnet ? t('pt.realTestnet') : t('pt.realLive')) : t('pt.subtitle')}</p>
                </div>
                <button className='positions-panel__close' onClick={onClose} aria-label='Close'>
                    ✕
                </button>
            </header>

            <div className='positions-panel__mode'>
                <div className='positions-panel__mode-tabs'>
                    <button className={`positions-panel__mode-tab ${!real ? 'is-active' : ''}`} onClick={() => setMode('demo')}>
                        {t('pt.demo')}
                    </button>
                    <button
                        className={`positions-panel__mode-tab is-real ${real ? 'is-active' : ''}`}
                        onClick={() => (hasCredentials ? setMode('real') : setShowKeys(true))}
                    >
                        {t('pt.real')}
                    </button>
                </div>
                <button className='positions-panel__keys' onClick={() => setShowKeys(true)} title={t('keys.title')}>
                    🔑
                </button>
            </div>

            {real ? (
                <RealView account={liveAccount} realUpnl={realUpnl} t={t} />
            ) : (
                <>
                    <div className='positions-panel__note'>⚠ {t('pt.localNote')}</div>

                    <div className='positions-panel__account'>
                        <div className='positions-panel__equity'>
                            <span className='positions-panel__label'>{t('pt.equity')}</span>
                            <b>{formatUsd(equity, 2)} USDT</b>
                        </div>
                        <div className='positions-panel__account-grid'>
                            <div>
                                <span>{t('pt.balance')}</span>
                                <b>{formatUsd(account.balance, 2)}</b>
                            </div>
                            <div>
                                <span>{t('pt.upnl')}</span>
                                <b className={pnlCls(upnl)}>{usdt(upnl)}</b>
                            </div>
                            <div>
                                <span>{t('pt.realized')}</span>
                                <b className={pnlCls(account.realized)}>{usdt(account.realized)}</b>
                            </div>
                        </div>
                        <label className='positions-panel__bankroll'>
                            <span>{t('pt.bankroll')}</span>
                            <input
                                className='positions-panel__bankroll-input'
                                type='number'
                                min={1}
                                step={100}
                                value={bankroll}
                                disabled={positions.length > 0}
                                onChange={(e) => setBankroll(e.target.value)}
                                onBlur={() => setStartBalance(parseFloat(bankroll) || startBalance)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                }}
                            />
                            <i>USDT</i>
                        </label>
                    </div>
                </>
            )}

            <div className='positions-panel__defaults'>
                <span className='positions-panel__label'>{t('pt.defaults')}</span>
                <label className='positions-panel__margin'>
                    <span>{t('pt.margin')}</span>
                    <input
                        type='number'
                        min={1}
                        step={10}
                        value={defaults.margin}
                        onChange={(e) => setDefaults({ margin: parseFloat(e.target.value) || 0 })}
                    />
                    <i>USDT</i>
                </label>
                <div className='positions-panel__levs'>
                    {LEVERAGES.map((l) => (
                        <button
                            key={l}
                            className={`positions-panel__lev ${defaults.leverage === l ? 'is-active' : ''}`}
                            onClick={() => setDefaults({ leverage: l })}
                        >
                            {l}x
                        </button>
                    ))}
                </div>
                <div className='positions-panel__margintype'>
                    <button
                        className={`positions-panel__mt ${defaults.marginType === 'ISOLATED' ? 'is-active' : ''}`}
                        onClick={() => setDefaults({ marginType: 'ISOLATED' })}
                    >
                        {t('pt.isolated')}
                    </button>
                    <button
                        className={`positions-panel__mt ${defaults.marginType === 'CROSSED' ? 'is-active' : ''}`}
                        onClick={() => setDefaults({ marginType: 'CROSSED' })}
                    >
                        {t('pt.cross')}
                    </button>
                </div>
                {!real && (
                    <>
                        <div className='positions-panel__fees'>
                            <div className='positions-panel__fee-modes'>
                                <button className={`positions-panel__fee-mode ${defaults.feeMode === 'taker' ? 'is-active' : ''}`} onClick={() => setDefaults({ feeMode: 'taker' })}>
                                    {t('pt.taker')}
                                </button>
                                <button className={`positions-panel__fee-mode ${defaults.feeMode === 'maker' ? 'is-active' : ''}`} onClick={() => setDefaults({ feeMode: 'maker' })}>
                                    {t('pt.maker')}
                                </button>
                            </div>
                            <label className={`positions-panel__bnb ${defaults.bnb ? 'is-on' : ''}`}>
                                <input type='checkbox' checked={defaults.bnb} onChange={(e) => setDefaults({ bnb: e.target.checked })} />
                                {t('pt.bnb')}
                            </label>
                        </div>
                        <p className='positions-panel__fee-note'>
                            {t('pt.feeNote', { rate: (feeRateOf(defaults.feeMode, defaults.bnb) * 100).toFixed(3), funding: (FUNDING_RATE * 100).toFixed(2) })}
                        </p>
                    </>
                )}
            </div>

            <div className='positions-panel__list-head'>
                <span>{t('pt.open')}</span>
                {!real && (positions.length > 0 || account.realized !== 0 || closed.length > 0) && (
                    <button className='positions-panel__reset' onClick={reset}>
                        {t('pt.reset')}
                    </button>
                )}
            </div>

            {real ? (
                <div className='positions-panel__list'>
                    {liveAccount.error ? (
                        <div className='positions-panel__empty positions-panel__empty--error'>{liveAccount.error}</div>
                    ) : liveAccount.positions.length === 0 ? (
                        <div className='positions-panel__empty'>{t('pt.none')}</div>
                    ) : (
                        liveAccount.positions.map((p) => (
                            <RealRow key={p.symbol} pos={p} creds={credentials!} onAfter={liveAccount.refresh} t={t} />
                        ))
                    )}
                </div>
            ) : (
                <div className='positions-panel__list'>
                    {rows.length === 0 ? (
                        <div className='positions-panel__empty'>{t('pt.none')}</div>
                    ) : (
                        rows.map((row) => (
                            <DemoRow key={row.p.id} row={row} now={now} setTpSl={setTpSl} close={close} t={t} />
                        ))
                    )}
                </div>
            )}

            {!real && closed.length > 0 && (
                <div className='positions-panel__history'>
                    <button className='positions-panel__history-head' onClick={() => setShowHistory((s) => !s)}>
                        <span>{t('pt.history')} ({closed.length})</span>
                        <span className={`positions-panel__chev ${showHistory ? 'is-open' : ''}`}>▾</span>
                    </button>
                    {showHistory && (
                        <div className='positions-panel__history-list'>
                            {closed.map((c) => (
                                <div key={c.id} className='positions-panel__closed'>
                                    <AssetLogo symbol={c.base} size={18} />
                                    <span className='positions-panel__closed-sym'>{c.base}</span>
                                    <span className={`positions-panel__closed-side is-${c.side.toLowerCase()}`}>{c.side}</span>
                                    {REASON[c.reason] && <span className={`positions-panel__closed-reason is-${c.reason}`}>{REASON[c.reason]}</span>}
                                    <span className={`positions-panel__closed-pnl ${pnlCls(c.pnl)}`}>{usdt(c.pnl)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showKeys && <CredentialsModal onClose={() => setShowKeys(false)} />}
        </aside>
    )
}

// --- helpers ----------------------------------------------------------------

const useDemoAutoClose = (
    real: boolean,
    positions: Position[],
    close: (id: string, price: number, reason?: 'manual' | 'tp' | 'sl' | 'liq') => void,
    now: number
) => {
    useEffect(() => {
        if (real) return
        for (const p of positions) {
            const price = getPrice(p.symbol)
            if (price === undefined) continue
            const liq = liqPrice(p)
            const long = p.side === 'LONG'
            if ((long && price <= liq) || (!long && price >= liq)) close(p.id, liq, 'liq')
            else if (p.tp !== null && ((long && price >= p.tp) || (!long && price <= p.tp))) close(p.id, p.tp, 'tp')
            else if (p.sl !== null && ((long && price <= p.sl) || (!long && price >= p.sl))) close(p.id, p.sl, 'sl')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [now, positions, real])
}

interface DemoRowData {
    p: Position
    price: number
    net: number
    roe: number
    liq: number
    fees: number
    funding: number
}

/** Live profit/loss estimate shown under a TP/SL input as the user types. */
const Est = ({ pnl, margin }: { pnl: number | null; margin: number }) => {
    if (pnl === null) return <span className='positions-panel__est' aria-hidden />
    const roe = margin > 0 ? (pnl / margin) * 100 : 0
    return (
        <span className={`positions-panel__est ${pnl >= 0 ? 'is-pos' : 'is-neg'}`}>
            {usdt(pnl)} <i>({usdt(roe)}%)</i>
        </span>
    )
}

const DemoRow = ({
    row,
    now,
    setTpSl,
    close,
    t
}: {
    row: DemoRowData
    now: number
    setTpSl: (id: string, tp: number | null, sl: number | null) => void
    close: (id: string, price: number) => void
    t: (k: string, v?: Record<string, string | number>) => string
}) => {
    const { p, price, net, roe, liq, fees, funding } = row
    const [tp, setTp] = useState(p.tp != null ? String(p.tp) : '')
    const [sl, setSl] = useState(p.sl != null ? String(p.sl) : '')

    // Commit only when the user clicks Set — typing must never arm the exit, or
    // a partial value (e.g. "1") would look "hit" and auto-close the position.
    const applyTpSl = () => setTpSl(p.id, parseNum(tp), parseNum(sl))

    // Estimated net PnL at the entered exit price (fees + funding included, just
    // like an actual close) so the figure matches what the position would book.
    const tpPrice = parseNum(tp)
    const slPrice = parseNum(sl)
    const tpPnl = tpPrice !== null ? netPnl(p, tpPrice, now) : null
    const slPnl = slPrice !== null ? netPnl(p, slPrice, now) : null

    return (
        <div className='positions-panel__pos'>
            <div className='positions-panel__pos-head'>
                <AssetLogo symbol={p.base} size={22} />
                <span className='positions-panel__pos-sym'>{p.base}</span>
                <span className={`positions-panel__side is-${p.side.toLowerCase()}`}>
                    {p.side} {p.leverage}x
                </span>
                <button className='positions-panel__pos-close' onClick={() => close(p.id, price)}>
                    {t('pt.close')}
                </button>
            </div>
            <div className={`positions-panel__pnl ${pnlCls(net)}`}>
                {usdt(net)} USDT <span>({usdt(roe)}%)</span>
            </div>
            <div className='positions-panel__pos-meta'>
                <span>
                    {t('pt.entry')} <b>{formatPrice(p.entryPrice, p.decimals)}</b> → <b>{formatPrice(price, p.decimals)}</b>
                </span>
                <span className='positions-panel__liq'>
                    {t('pt.liq')} <b>{formatPrice(liq, p.decimals)}</b>
                </span>
            </div>
            <div className='positions-panel__costs'>
                {t('pt.fees')} <b>-{formatUsd(fees, 2)}</b> · {t('pt.funding')} <b>{usdt(-funding)}</b>
            </div>
            <div className='positions-panel__tpsl'>
                <label>
                    <span>{t('pt.tp')}</span>
                    <input type='number' step='any' value={tp} placeholder='—' onChange={(e) => setTp(e.target.value)} />
                </label>
                <label>
                    <span>{t('pt.sl')}</span>
                    <input type='number' step='any' value={sl} placeholder='—' onChange={(e) => setSl(e.target.value)} />
                </label>
                <Est pnl={tpPnl} margin={p.margin} />
                <Est pnl={slPnl} margin={p.margin} />
                <button className='positions-panel__tpsl-set' onClick={applyTpSl}>
                    {t('pt.set')}
                </button>
            </div>
        </div>
    )
}

/**
 * Watches real positions and market-closes one when its app-managed TP/SL is
 * hit (the native conditional-order endpoint is rejected on some accounts).
 * Also prunes stored levels for positions that are no longer open.
 */
const useRealTpSlGuard = (creds: Credentials | null, positions: RealPosition[], refresh: () => void) => {
    const closing = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!creds) return

        const open = new Set(positions.map((p) => p.symbol))
        for (const sym of localTpSlSymbols()) if (!open.has(sym)) clearLocalTpSl(sym)

        for (const pos of positions) {
            const { tp, sl } = getLocalTpSl(pos.symbol)
            if (tp === null && sl === null) continue
            const price = pos.markPrice
            if (!(price > 0)) continue
            const long = pos.side === 'LONG'
            const hitTp = tp !== null && (long ? price >= tp : price <= tp)
            const hitSl = sl !== null && (long ? price <= sl : price >= sl)
            if ((hitTp || hitSl) && !closing.current.has(pos.symbol)) {
                closing.current.add(pos.symbol)
                realClose(creds, pos)
                    .then(() => clearLocalTpSl(pos.symbol))
                    .catch(() => {})
                    .finally(() => {
                        closing.current.delete(pos.symbol)
                        refresh()
                    })
            }
        }
    }, [positions, creds, refresh])
}

const RealView = ({
    account,
    realUpnl,
    t
}: {
    account: ReturnType<typeof useRealAccount>
    realUpnl: number
    t: (k: string, v?: Record<string, string | number>) => string
}) => (
    <div className='positions-panel__account'>
        <div className='positions-panel__equity'>
            <span className='positions-panel__label'>{t('pt.balance')}</span>
            <b>{account.balance === null ? '—' : `${formatUsd(account.balance, 2)} USDT`}</b>
        </div>
        <div className='positions-panel__account-grid'>
            <div>
                <span>{t('pt.upnl')}</span>
                <b className={pnlCls(realUpnl)}>{usdt(realUpnl)}</b>
            </div>
            <div>
                <span>{t('pt.open')}</span>
                <b>{account.positions.length}</b>
            </div>
            <div>
                <span>{t('pt.status')}</span>
                <b className={account.error ? 'is-neg' : 'is-pos'}>{account.error ? '⚠' : '●'}</b>
            </div>
        </div>
    </div>
)

const RealRow = ({
    pos,
    creds,
    onAfter,
    t
}: {
    pos: RealPosition
    creds: Credentials
    onAfter: () => void
    t: (k: string, v?: Record<string, string | number>) => string
}) => {
    const { push: pushToast } = useToast()
    const local = getLocalTpSl(pos.symbol)
    const [tp, setTp] = useState(local.tp != null ? String(local.tp) : '')
    const [sl, setSl] = useState(local.sl != null ? String(local.sl) : '')
    const [busy, setBusy] = useState(false)
    const [askClose, setAskClose] = useState(false)
    const margin = (pos.qty * pos.entryPrice) / pos.leverage
    const roe = margin > 0 ? (pos.pnl / margin) * 100 : 0

    // Live PnL estimate at the entered exit price (price move × position size).
    const long = pos.side === 'LONG'
    const estAt = (s: string): number | null => {
        const x = parseNum(s)
        if (x === null) return null
        return (long ? x - pos.entryPrice : pos.entryPrice - x) * pos.qty
    }
    const tpPnl = estAt(tp)
    const slPnl = estAt(sl)

    const fail = (e: unknown) =>
        pushToast({ variant: 'error', title: t('toast.failedTitle'), message: e instanceof Error ? e.message : String(e) })

    const doClose = async () => {
        setAskClose(false)
        setBusy(true)
        try {
            await realClose(creds, pos)
            onAfter()
            pushToast({ variant: 'success', title: t('toast.closedTitle'), message: t('toast.closedMsg', { sym: pos.base }) })
        } catch (e) {
            fail(e)
        } finally {
            setBusy(false)
        }
    }

    // Store the exit levels locally; the guard market-closes when one is hit.
    const applyTpSl = () => {
        setLocalTpSl(pos.symbol, parseNum(tp), parseNum(sl))
        pushToast({ variant: 'success', title: t('toast.tpslTitle'), message: t('toast.tpslMsg', { sym: pos.base }) })
    }

    return (
        <div className='positions-panel__pos'>
            {askClose && (
                <ConfirmDialog
                    title={t('pt.confirmCloseTitle')}
                    message={t('pt.confirmClose', { sym: pos.symbol })}
                    confirmLabel={t('pt.close')}
                    cancelLabel={t('order.cancel')}
                    danger
                    busy={busy}
                    onConfirm={doClose}
                    onCancel={() => setAskClose(false)}
                />
            )}
            <div className='positions-panel__pos-head'>
                <AssetLogo symbol={pos.base} size={22} />
                <span className='positions-panel__pos-sym'>{pos.base}</span>
                <span className={`positions-panel__side is-${pos.side.toLowerCase()}`}>
                    {pos.side} {pos.leverage}x
                </span>
                <button className='positions-panel__pos-close' onClick={() => setAskClose(true)} disabled={busy}>
                    {t('pt.close')}
                </button>
            </div>
            <div className={`positions-panel__pnl ${pnlCls(pos.pnl)}`}>
                {usdt(pos.pnl)} USDT <span>({usdt(roe)}%)</span>
            </div>
            <div className='positions-panel__pos-meta'>
                <span>
                    {t('pt.entry')} <b>{formatPrice(pos.entryPrice)}</b> → <b>{formatPrice(pos.markPrice)}</b>
                </span>
                <span className='positions-panel__liq'>
                    {t('pt.liq')} <b>{pos.liqPrice > 0 ? formatPrice(pos.liqPrice) : '—'}</b>
                </span>
            </div>
            <div className='positions-panel__tpsl'>
                <label>
                    <span>{t('pt.tp')}</span>
                    <input type='number' step='any' value={tp} placeholder='—' onChange={(e) => setTp(e.target.value)} />
                </label>
                <label>
                    <span>{t('pt.sl')}</span>
                    <input type='number' step='any' value={sl} placeholder='—' onChange={(e) => setSl(e.target.value)} />
                </label>
                <Est pnl={tpPnl} margin={margin} />
                <Est pnl={slPnl} margin={margin} />
                <button className='positions-panel__tpsl-set' onClick={applyTpSl} disabled={busy}>
                    {t('pt.set')}
                </button>
            </div>
            <p className='positions-panel__tpsl-note'>ⓘ {t('pt.tpslLocal')}</p>
        </div>
    )
}
