import { createPortal } from 'react-dom'
import { useI18n } from '../../context/I18nContext'
import { SampleChart } from '../SampleChart/SampleChart'
import './StrategyModal.scss'

interface StrategyModalProps {
    onClose: () => void
}

export const StrategyModal = ({ onClose }: StrategyModalProps) => {
    const { t } = useI18n()

    return createPortal(
        <div className='stratm' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='stratm__panel' onClick={(e) => e.stopPropagation()}>
                <header className='stratm__head'>
                    <div>
                        <h3>{t('strat.modalTitle')}</h3>
                        <p>{t('strat.modalSub')}</p>
                    </div>
                    <button className='stratm__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                </header>

                <div className='stratm__chart'>
                    <SampleChart />
                </div>

                <ul className='stratm__list'>
                    <li dangerouslySetInnerHTML={{ __html: t('how.stratLong') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('how.stratShort') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('how.stratFake') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('how.stratCapit') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('how.stratPlan') }} />
                </ul>

                <p className='stratm__note'>{t('strat.illustrative')}</p>
            </div>
        </div>,
        document.body
    )
}
