import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../context/I18nContext'
import type { OrderPlan } from '../../services/binanceTrade'
import './OrderModal.scss'

export type OrderStatus = 'confirm' | 'placing' | 'success' | 'error'

interface OrderModalProps {
    side: 'LONG' | 'SHORT'
    symbol: string
    plan: OrderPlan | null
    testnet: boolean
    status: OrderStatus
    error?: string
    onConfirm: () => void
    onClose: () => void
}

export const OrderModal = ({ side, symbol, plan, testnet, status, error, onConfirm, onClose }: OrderModalProps) => {
    const { t } = useI18n()
    const long = side === 'LONG'
    const sideWord = t(long ? 'card.long' : 'card.short')
    const busy = status === 'placing'

    // Escape to dismiss (never while an order is in flight); auto-close on success.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [busy, onClose])

    useEffect(() => {
        if (status !== 'success') return
        const id = setTimeout(onClose, 2000)
        return () => clearTimeout(id)
    }, [status, onClose])

    const icon =
        status === 'placing' ? (
            <span className='om__spinner' aria-hidden />
        ) : status === 'success' ? (
            '✓'
        ) : status === 'error' ? (
            '!'
        ) : long ? (
            '▲'
        ) : (
            '▼'
        )

    const title =
        status === 'placing'
            ? t('order.placingTitle')
            : status === 'success'
              ? t('order.successTitle')
              : status === 'error'
                ? t('order.errorTitle')
                : testnet
                  ? t('order.confirmTest')
                  : t('order.confirmLive')

    const sub =
        status === 'placing'
            ? t('order.placingSub', { side: sideWord })
            : status === 'success'
              ? t('order.successSub', { side: sideWord, sym: symbol, qty: plan ? String(plan.quantity) : '' })
              : status === 'error'
                ? t('order.errorSub')
                : testnet
                  ? t('order.subTest')
                  : t('order.subLive')

    const showDetails = !!plan && status !== 'error'

    return createPortal(
        <div className='om' role='dialog' aria-modal='true' onClick={busy ? undefined : onClose}>
            <div
                className={`om__panel om--${side.toLowerCase()} om--${status} ${testnet ? 'is-test' : 'is-live'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {!busy && (
                    <button className='om__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                )}

                <div className={`om__icon om__icon--${status}`}>{icon}</div>
                <h3 className='om__title'>{title}</h3>
                <p className='om__sub'>{sub}</p>

                {showDetails && (
                    <dl className='om__grid'>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.symbol')}</dt>
                            <dd className='om__v'>{symbol}</dd>
                        </div>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.sideLabel')}</dt>
                            <dd className='om__v'>
                                <span className={`om__pill ${long ? 'is-long' : 'is-short'}`}>{side}</span>
                            </dd>
                        </div>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.size')}</dt>
                            <dd className='om__v'>{plan!.quantity}</dd>
                        </div>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.notional')}</dt>
                            <dd className='om__v'>≈ {plan!.notional.toFixed(2)} USDT</dd>
                        </div>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.leverage')}</dt>
                            <dd className='om__v'>{plan!.leverage}×</dd>
                        </div>
                        <div className='om__row'>
                            <dt className='om__k'>{t('order.account')}</dt>
                            <dd className='om__v'>
                                <span className={`om__badge ${testnet ? 'is-test' : 'is-live'}`}>
                                    {testnet ? t('order.testnet') : t('order.live')}
                                </span>
                            </dd>
                        </div>
                    </dl>
                )}

                {status === 'error' && error && <pre className='om__error'>{error}</pre>}

                <div className='om__foot'>
                    {status === 'confirm' && (
                        <>
                            <button className='om__btn om__btn--ghost' onClick={onClose}>
                                {t('order.cancel')}
                            </button>
                            <button className={`om__btn ${long ? 'om__btn--long' : 'om__btn--short'}`} onClick={onConfirm}>
                                {t('order.confirmBtn', { side: sideWord })}
                            </button>
                        </>
                    )}
                    {status === 'placing' && (
                        <button className='om__btn om__btn--ghost' disabled>
                            {t('order.placingTitle')}
                        </button>
                    )}
                    {status === 'success' && (
                        <button className='om__btn om__btn--accent' onClick={onClose}>
                            {t('order.done')}
                        </button>
                    )}
                    {status === 'error' && (
                        <>
                            <button className='om__btn om__btn--ghost' onClick={onClose}>
                                {t('order.close')}
                            </button>
                            {plan && (
                                <button className={`om__btn ${long ? 'om__btn--long' : 'om__btn--short'}`} onClick={onConfirm}>
                                    {t('order.retry')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
