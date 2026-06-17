import { useTheme } from '../../context/ThemeContext'
import './ThemeToggle.scss'

export const ThemeToggle = () => {
    const { theme, toggle } = useTheme()
    const isDark = theme === 'dark'

    return (
        <button
            className='theme-toggle'
            onClick={toggle}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
            <span className={`theme-toggle__track ${isDark ? 'is-dark' : ''}`}>
                <span className='theme-toggle__thumb'>{isDark ? '🌙' : '☀️'}</span>
            </span>
        </button>
    )
}
