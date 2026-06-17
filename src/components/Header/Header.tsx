import { ThemeToggle } from '../ThemeToggle/ThemeToggle'
import { LanguageToggle } from '../LanguageToggle/LanguageToggle'
import { NotifyToggle } from '../NotifyToggle/NotifyToggle'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useI18n } from '../../context/I18nContext'
import './Header.scss'

interface HeaderProps {
    symbols: string[]
}

export const Header = ({ symbols }: HeaderProps) => {
    const assetCount = symbols.length
    const online = useOnlineStatus()
    const { t } = useI18n()

    return (
        <header className='app-header'>
            <div className='app-header__brand'>
                <span className='app-header__logo' aria-hidden>
                    <svg viewBox='0 0 32 32' width='34' height='34'>
                        <defs>
                            <linearGradient id='hg' x1='0' y1='0' x2='1' y2='1'>
                                <stop offset='0' stopColor='var(--cyan)' />
                                <stop offset='1' stopColor='var(--accent)' />
                            </linearGradient>
                        </defs>
                        <rect width='32' height='32' rx='9' fill='url(#hg)' />
                        <path
                            d='M6 20 L13 13 L18 18 L26 8'
                            fill='none'
                            stroke='#fff'
                            strokeWidth='2.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                        <circle cx='26' cy='8' r='2.4' fill='#fff' />
                    </svg>
                </span>
                <div className='app-header__title'>
                    <h1>
                        V<span>Bounce</span>
                    </h1>
                    <p>{t('header.tagline')}</p>
                </div>
            </div>

            <div className='app-header__right'>
                <span className={`app-header__net ${online ? 'is-online' : 'is-offline'}`}>
                    <span className='app-header__net-dot' />
                    {online ? t('net.connected') : t('net.offline')}
                </span>
                <span className='app-header__count'>
                    <b>{assetCount}</b> {assetCount === 1 ? t('header.market') : t('header.markets')}
                </span>
                <NotifyToggle symbols={symbols} />
                <LanguageToggle />
                <ThemeToggle />
            </div>
        </header>
    )
}
