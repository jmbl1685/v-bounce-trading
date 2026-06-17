import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext'
import { StrategyProvider } from './context/StrategyContext'
import { I18nProvider } from './context/I18nContext'
import { PaperTradingProvider } from './context/PaperTradingContext'
import { TradingModeProvider } from './context/TradingModeContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { ToastProvider } from './context/ToastContext'
import { App } from './App'
import { initCursors } from './utils/cursors'
import './global.scss'

initCursors()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            <ThemeProvider>
                <StrategyProvider>
                    <PaperTradingProvider>
                        <TradingModeProvider>
                            <NotificationsProvider>
                                <ToastProvider>
                                    <App />
                                </ToastProvider>
                            </NotificationsProvider>
                        </TradingModeProvider>
                    </PaperTradingProvider>
                </StrategyProvider>
            </ThemeProvider>
        </I18nProvider>
    </StrictMode>
)
