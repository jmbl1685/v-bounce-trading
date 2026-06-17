import type { Interval, SignalKind } from '../../types'
import { getHorizon, formatCountdown } from '../../utils/horizon'
import { useNow } from '../../hooks/useNow'
import { useI18n } from '../../context/I18nContext'
import './HorizonTag.scss'

interface HorizonTagProps {
    interval: Interval
    /** Open time of the in-progress candle, for the close countdown. */
    lastOpenTime: number | null
    signal: SignalKind
}

export const HorizonTag = ({ interval, lastOpenTime, signal }: HorizonTagProps) => {
    const { t } = useI18n()
    const now = useNow(1000)
    const horizon = getHorizon(interval)

    const closeTime = lastOpenTime !== null ? lastOpenTime + horizon.candleMs : null
    const remaining = closeTime !== null ? closeTime - now : null
    const progress =
        remaining !== null ? Math.min(1, Math.max(0, 1 - remaining / horizon.candleMs)) : 0

    const active = signal === 'LONG' || signal === 'SHORT'
    const holdLabel = active ? t('horizon.expectedHold') : t('horizon.setupHorizon')

    return (
        <div className='horizon-tag'>
            <div className='horizon-tag__row'>
                <span className={`horizon-tag__style horizon-tag__style--${horizon.style.toLowerCase()}`}>
                    ⏱ {t(`horizon.${horizon.style.toLowerCase()}`)}
                </span>
                <span className='horizon-tag__hold'>
                    {holdLabel} <b>≈ {horizon.hold}</b>
                </span>
                {remaining !== null && (
                    <span className='horizon-tag__close'>
                        {t('horizon.closesIn')} <b>{formatCountdown(remaining)}</b>
                    </span>
                )}
            </div>
            <div className='horizon-tag__bar'>
                <span className='horizon-tag__bar-fill' style={{ width: `${progress * 100}%` }} />
            </div>
        </div>
    )
}
