import type { Signal } from '../../types'
import './SignalBadge.scss'

interface SignalBadgeProps {
    signal: Signal | null
    size?: 'sm' | 'lg'
}

const META: Record<string, { label: string; icon: string; modifier: string }> = {
    LONG: { label: 'LONG', icon: '▲', modifier: 'long' },
    SHORT: { label: 'SHORT', icon: '▼', modifier: 'short' },
    WAIT: { label: 'WAIT', icon: '⏸', modifier: 'wait' }
}

export const SignalBadge = ({ signal, size = 'sm' }: SignalBadgeProps) => {
    if (!signal) {
        return <span className={`signal-badge signal-badge--wait signal-badge--${size}`}>· · ·</span>
    }

    const meta = META[signal.kind] ?? META.WAIT

    return (
        <span
            className={`signal-badge signal-badge--${meta.modifier} signal-badge--${size}`}
            title={`${signal.confidence}% confidence`}
        >
            <span className='signal-badge__icon'>{meta.icon}</span>
            <span className='signal-badge__label'>{meta.label}</span>
            {size === 'lg' && <span className='signal-badge__conf'>{signal.confidence}%</span>}
        </span>
    )
}
