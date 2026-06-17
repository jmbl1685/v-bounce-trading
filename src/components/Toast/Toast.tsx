import { createPortal } from 'react-dom'
import { TOAST_TTL, useToast } from '../../context/ToastContext'
import './Toast.scss'

const ICON: Record<string, string> = { success: '✓', error: '!', info: 'i' }

export const ToastHost = () => {
    const { toasts, dismiss } = useToast()
    if (!toasts.length) return null

    return createPortal(
        <div className='toast' role='region' aria-live='polite'>
            {toasts.map((t) => (
                <div key={t.id} className={`toast__item toast__item--${t.variant}`} role='status'>
                    <span className='toast__icon'>{ICON[t.variant]}</span>
                    <div className='toast__body'>
                        <strong className='toast__title'>{t.title}</strong>
                        {t.message && <span className='toast__msg'>{t.message}</span>}
                    </div>
                    <button className='toast__close' onClick={() => dismiss(t.id)} aria-label='Dismiss'>
                        ✕
                    </button>
                    <span className='toast__bar' style={{ animationDuration: `${TOAST_TTL[t.variant]}ms` }} />
                </div>
            ))}
        </div>,
        document.body
    )
}
