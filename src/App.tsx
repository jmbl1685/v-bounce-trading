import { useEffect, useState } from 'react'
import type { Interval } from './types'
import { Header } from './components/Header/Header'
import { AddAssetForm } from './components/AddAssetForm/AddAssetForm'
import { AssetCard } from './components/AssetCard/AssetCard'
import { HowItWorks } from './components/HowItWorks/HowItWorks'
import { PositionsPanel } from './components/PositionsPanel/PositionsPanel'
import { ClaudeMark } from './components/ClaudeMark/ClaudeMark'
import { ToastHost } from './components/Toast/Toast'
import { useI18n } from './context/I18nContext'
import { usePaperTrading } from './context/PaperTradingContext'
import './App.scss'

const STORAGE_KEY = 'v-bounce-watchlist'
const INTERVAL_KEY = 'v-bounce-interval'
const PANEL_KEY = 'v-bounce-panel-open'
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

const loadWatchlist = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch {
        /* fall through to default */
    }
    return DEFAULT_WATCHLIST
}

const loadInterval = (): Interval => {
    const raw = localStorage.getItem(INTERVAL_KEY)
    const valid: Interval[] = ['1m', '5m', '15m', '1h', '4h']
    return valid.includes(raw as Interval) ? (raw as Interval) : '15m'
}

export const App = () => {
    const { t } = useI18n()
    const { positions } = usePaperTrading()
    const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
    const [interval, setInterval] = useState<Interval>(loadInterval)
    const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(PANEL_KEY) !== 'false')

    useEffect(() => {
        localStorage.setItem(PANEL_KEY, String(panelOpen))
    }, [panelOpen])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
    }, [watchlist])

    useEffect(() => {
        localStorage.setItem(INTERVAL_KEY, interval)
    }, [interval])

    const addAsset = (symbol: string) => {
        setWatchlist((list) => (list.includes(symbol) ? list : [...list, symbol]))
    }

    const removeAsset = (symbol: string) => {
        setWatchlist((list) => list.filter((s) => s !== symbol))
    }

    return (
        <div className={`app ${panelOpen ? 'app--panel' : ''}`}>
            <div className='app__shell'>
                <Header symbols={watchlist} />

                <AddAssetForm
                    interval={interval}
                    existing={watchlist}
                    onAdd={addAsset}
                    onIntervalChange={setInterval}
                />

                <HowItWorks />

                {watchlist.length === 0 ? (
                    <div className='app__empty'>
                        <div className='app__empty-icon'>📡</div>
                        <h2>{t('app.emptyTitle')}</h2>
                        <p>{t('app.emptyBody')}</p>
                    </div>
                ) : (
                    <section className='app__grid'>
                        {watchlist.map((symbol) => (
                            <AssetCard
                                key={`${symbol}-${interval}`}
                                symbol={symbol}
                                interval={interval}
                                onRemove={removeAsset}
                            />
                        ))}
                    </section>
                )}

                <footer className='app__footer'>
                    <p>{t('app.footer')}</p>
                    <div className='app__credit-wrap'>
                        <a
                            className='app__credit'
                            href='https://claude.com/claude-code'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <ClaudeMark size={16} />
                            Created by Claude Code
                        </a>
                        <span className='app__credit-note'>Under Juan Batty technical instructions</span>
                    </div>
                </footer>
            </div>

            <PositionsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

            <ToastHost />

            {!panelOpen && (
                <button className='app__panel-toggle' onClick={() => setPanelOpen(true)}>
                    📋 {t('pt.toggle')}
                    {positions.length > 0 && <span className='app__panel-badge'>{positions.length}</span>}
                </button>
            )}
        </div>
    )
}
