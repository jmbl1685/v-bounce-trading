import type { ReactNode } from 'react'
import { useDisplayCurrency } from '../../context/DisplayCurrencyContext'
import { useI18n } from '../../context/I18nContext'
import { AssetLogo } from '../AssetLogo/AssetLogo'
import { formatPrice, formatUsd, formatOpenedAt } from '../../utils/format'
import './ClosedTradeCard.scss'

/** Normalized view of a closed trade — fed by both demo and real history. */
export interface ClosedTradeView {
    base: string
    side: 'LONG' | 'SHORT'
    leverage: number
    reason: 'manual' | 'tp' | 'sl' | 'liq'
    pnl: number
    roe: number
    entryPrice?: number
    exitPrice?: number
    margin?: number
    decimals?: number
    strategy?: string
    interval?: string | null
    openedAt?: number
    closedAt: number
}

const REASON_LABEL: Record<string, string> = { tp: 'TP', sl: 'SL', liq: 'LIQ' }

export const ClosedTradeCard = ({ trade }: { trade: ClosedTradeView }) => {
    const { t, lang } = useI18n()
    const ccy = useDisplayCurrency()

    const money = (v: number, signed = false): string => {
        const c = ccy.conv(v)
        const digits = ccy.unit !== 'USDT' && Math.abs(c) >= 1000 ? 0 : 2
        const body = formatUsd(c, digits)
        return signed && v >= 0 ? `+${body}` : body
    }

    const pnlCls = trade.pnl > 0 ? 'is-pos' : trade.pnl < 0 ? 'is-neg' : ''
    const reasonBadge = REASON_LABEL[trade.reason]

    const stat = (label: string, value: ReactNode, cls = ''): ReactNode => (
        <div className='closed-card__stat'>
            <span className='closed-card__stat-label'>{label}</span>
            <span className={`closed-card__stat-val ${cls}`}>{value}</span>
        </div>
    )

    return (
        <div className='closed-card'>
            <div className='closed-card__head'>
                <AssetLogo symbol={trade.base} size={22} />
                <span className='closed-card__sym'>{trade.base}</span>
                <span className={`closed-card__side is-${trade.side.toLowerCase()}`}>
                    {trade.side} {trade.leverage}x
                </span>
                {reasonBadge && <span className={`closed-card__reason is-${trade.reason}`}>{reasonBadge}</span>}
                <span className={`closed-card__pnl ${pnlCls}`}>
                    {money(trade.pnl, true)} {ccy.unit}
                    <i>
                        ({trade.roe >= 0 ? '+' : ''}
                        {trade.roe.toFixed(2)}%)
                    </i>
                </span>
            </div>
            <div className='closed-card__grid'>
                {trade.entryPrice !== undefined && stat(t('pt.entry'), formatPrice(trade.entryPrice, trade.decimals))}
                {trade.exitPrice !== undefined && stat(t('pt.exit'), formatPrice(trade.exitPrice, trade.decimals))}
                {trade.margin !== undefined && stat(t('pt.margin'), `${money(trade.margin)} ${ccy.unit}`)}
                {stat(t('pt.leverage'), `${trade.leverage}x`)}
                {trade.strategy && stat(t('pt.strategy'), t(`strategy.${trade.strategy}.name`))}
                {trade.interval && stat(t('pt.timeframe'), trade.interval)}
                {trade.openedAt !== undefined && stat(t('pt.opened'), formatOpenedAt(trade.openedAt, lang))}
                {stat(t('pt.closedAt'), formatOpenedAt(trade.closedAt, lang))}
            </div>
        </div>
    )
}
