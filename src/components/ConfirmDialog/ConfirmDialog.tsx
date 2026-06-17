import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmDialog.scss'

interface ConfirmDialogProps {
    title: string
    message?: string
    confirmLabel: string
    cancelLabel: string
    /** Render the confirm button in the destructive (red) style. */
    danger?: boolean
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export const ConfirmDialog = ({
    title,
    message,
    confirmLabel,
    cancelLabel,
    danger,
    busy,
    onConfirm,
    onCancel
}: ConfirmDialogProps) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onCancel()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [busy, onCancel])

    return createPortal(
        <div className='confirm' role='dialog' aria-modal='true' onClick={busy ? undefined : onCancel}>
            <div className={`confirm__panel ${danger ? 'is-danger' : ''}`} onClick={(e) => e.stopPropagation()}>
                <h3 className='confirm__title'>{title}</h3>
                {message && <p className='confirm__msg'>{message}</p>}
                <div className='confirm__foot'>
                    <button className='confirm__btn confirm__btn--ghost' onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button
                        className={`confirm__btn ${danger ? 'confirm__btn--danger' : 'confirm__btn--accent'}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
