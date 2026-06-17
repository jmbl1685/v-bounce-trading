import type { AssetStatus } from '../../types'
import { useI18n } from '../../context/I18nContext'
import './StatusTag.scss'

interface StatusTagProps {
    status: AssetStatus
    reconnectAttempts?: number
}

const PULSE: Record<AssetStatus, boolean> = {
    live: true,
    connecting: true,
    reconnecting: true,
    offline: false,
    error: false
}

export const StatusTag = ({ status, reconnectAttempts = 0 }: StatusTagProps) => {
    const { t } = useI18n()
    const showAttempt = status === 'reconnecting' && reconnectAttempts > 0

    return (
        <span className={`status-tag status-tag--${status}`} role='status'>
            <span className={`status-tag__dot ${PULSE[status] ? 'is-pulsing' : ''}`} />
            <span className='status-tag__label'>{t(`status.${status}`)}</span>
            {showAttempt && <span className='status-tag__attempt'>#{reconnectAttempts}</span>}
        </span>
    )
}
