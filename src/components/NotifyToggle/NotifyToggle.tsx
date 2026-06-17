import { useState } from 'react'
import { useNotifications } from '../../context/NotificationsContext'
import { useI18n } from '../../context/I18nContext'
import './NotifyToggle.scss'

interface NotifyToggleProps {
    symbols: string[]
}

const base = (s: string) => s.replace(/USDT$|BUSD$|USDC$/, '')

export const NotifyToggle = ({ symbols }: NotifyToggleProps) => {
    const {
        supported,
        permission,
        enabled,
        sound,
        minConfidence,
        muted,
        enable,
        disable,
        setSound,
        setMinConfidence,
        toggleMuted
    } = useNotifications()
    const { t } = useI18n()
    const [open, setOpen] = useState(false)

    if (!supported) return null

    const blocked = permission === 'denied'

    return (
        <div className='notify'>
            <button
                className={`notify-toggle ${enabled ? 'is-on' : ''} ${blocked ? 'is-blocked' : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-label={t('notif.settings')}
                title={t('notif.settings')}
            >
                {enabled && !blocked ? '🔔' : '🔕'}
            </button>

            {open && (
                <>
                    <div className='notify__overlay' onClick={() => setOpen(false)} />
                    <div className='notify__pop'>
                        <div className='notify__row notify__row--master'>
                            <span>{t('notif.master')}</span>
                            <button
                                className={`notify__switch ${enabled ? 'is-on' : ''}`}
                                disabled={blocked}
                                onClick={() => (enabled ? disable() : enable())}
                            >
                                <span className='notify__switch-dot' />
                            </button>
                        </div>

                        {blocked && <p className='notify__blocked'>{t('notif.blocked')}</p>}

                        <label className='notify__row'>
                            <span>{t('notif.sound')}</span>
                            <input type='checkbox' checked={sound} onChange={(e) => setSound(e.target.checked)} />
                        </label>

                        <div className='notify__row notify__row--col'>
                            <span>{t('notif.minConf', { v: minConfidence })}</span>
                            <input
                                type='range'
                                min={0}
                                max={95}
                                step={5}
                                value={minConfidence}
                                onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
                            />
                        </div>

                        {symbols.length > 0 && (
                            <div className='notify__pairs'>
                                <span className='notify__pairs-label'>{t('notif.pairs')}</span>
                                {symbols.map((s) => (
                                    <label key={s} className='notify__pair'>
                                        <input
                                            type='checkbox'
                                            checked={!muted.includes(s)}
                                            onChange={() => toggleMuted(s)}
                                        />
                                        {base(s)}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
