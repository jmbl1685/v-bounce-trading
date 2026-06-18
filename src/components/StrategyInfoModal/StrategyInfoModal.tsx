import { createPortal } from 'react-dom'
import { useI18n } from '../../context/I18nContext'
import { STRATEGIES } from '../../strategies/registry'
import type { StrategyKind } from '../../strategies/types'
import { SampleChart } from '../SampleChart/SampleChart'
import { BollingerSample } from '../BollingerSample/BollingerSample'
import { TradingLatinoSample } from '../TradingLatinoSample/TradingLatinoSample'
import { SupertrendSample } from '../SupertrendSample/SupertrendSample'
import { EmaPullbackSample } from '../EmaPullbackSample/EmaPullbackSample'
import { DonchianSample } from '../DonchianSample/DonchianSample'
import { SmcSample } from '../SmcSample/SmcSample'
import { StochasticSample } from '../StochasticSample/StochasticSample'
import './StrategyInfoModal.scss'

interface StrategyInfoModalProps {
    id: StrategyKind
    onClose: () => void
}

const SAMPLE: Record<StrategyKind, () => JSX.Element> = {
    vbounce: SampleChart,
    bollinger: BollingerSample,
    tradinglatino: TradingLatinoSample,
    supertrend: SupertrendSample,
    emapullback: EmaPullbackSample,
    donchian: DonchianSample,
    smc: SmcSample,
    stochastic: StochasticSample
}

export const StrategyInfoModal = ({ id, onClose }: StrategyInfoModalProps) => {
    const { t } = useI18n()
    const meta = STRATEGIES.find((s) => s.id === id)
    const bullets = meta ? meta.bullets : 0
    const Sample = SAMPLE[id]

    return createPortal(
        <div className='stratinfo' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='stratinfo__panel' onClick={(e) => e.stopPropagation()}>
                <header className='stratinfo__head'>
                    <div>
                        <h3>{t(`strategy.${id}.name`)}</h3>
                        <p>{t(`strategy.${id}.tagline`)}</p>
                    </div>
                    <button className='stratinfo__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                </header>

                {Sample && (
                    <div className='stratinfo__chart'>
                        <Sample />
                    </div>
                )}

                <p className='stratinfo__intro' dangerouslySetInnerHTML={{ __html: t(`strategy.${id}.intro`) }} />

                <ul className='stratinfo__list'>
                    {Array.from({ length: bullets }).map((_, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: t(`strategy.${id}.b${i + 1}`) }} />
                    ))}
                </ul>

                <p className='stratinfo__note'>{t('strategy.illustrative')}</p>
            </div>
        </div>,
        document.body
    )
}
