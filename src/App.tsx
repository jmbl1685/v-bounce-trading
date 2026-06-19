import { useEffect, useState } from 'react'
import type { Interval } from './types'
import { Header } from './components/Header/Header'
import { TutorialPage } from './components/TutorialPage/TutorialPage'
import { AddAssetForm } from './components/AddAssetForm/AddAssetForm'
import { AssetCard } from './components/AssetCard/AssetCard'
import { HowItWorks } from './components/HowItWorks/HowItWorks'
import { PositionsPanel } from './components/PositionsPanel/PositionsPanel'
import { ClaudeMark } from './components/ClaudeMark/ClaudeMark'
import { ToastHost } from './components/Toast/Toast'
import { useI18n } from './context/I18nContext'
import { usePaperTrading } from './context/PaperTradingContext'
import { Store } from './utils/store'
import './App.scss'

const STORAGE_KEY = 'v-bounce-watchlist'
const INTERVAL_KEY = 'v-bounce-interval'
const PANEL_KEY = 'v-bounce-panel-open'
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

const loadWatchlist = (): string[] => Store.get<string[]>(STORAGE_KEY, DEFAULT_WATCHLIST)

const loadInterval = (): Interval => {
    const raw = Store.getString(INTERVAL_KEY)
    const valid: Interval[] = ['1m', '5m', '15m', '1h', '4h']
    return valid.includes(raw as Interval) ? (raw as Interval) : '15m'
}

export const App = () => {
    const { t } = useI18n()
    const { positions } = usePaperTrading()
    const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
    const [interval, setInterval] = useState<Interval>(loadInterval)
    const [panelOpen, setPanelOpen] = useState(() => Store.getString(PANEL_KEY) !== 'false')
    const [showTutorial, setShowTutorial] = useState(false)
    const [view, setView] = useState<'markets' | 'positions'>('markets')

    useEffect(() => {
        Store.setString(PANEL_KEY, String(panelOpen))
    }, [panelOpen])

    useEffect(() => {
        Store.set(STORAGE_KEY, watchlist)
    }, [watchlist])

    useEffect(() => {
        Store.setString(INTERVAL_KEY, interval)
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
                <Header symbols={watchlist} onOpenTutorial={() => setShowTutorial(true)} />

                <div className='app__tabs' role='tablist'>
                    <button
                        className={`app__tab ${view === 'markets' ? 'is-active' : ''}`}
                        onClick={() => setView('markets')}
                    >
                        {t('app.tabMarkets')}
                    </button>
                    <button
                        className={`app__tab ${view === 'positions' ? 'is-active' : ''}`}
                        onClick={() => setView('positions')}
                    >
                        {t('app.tabPositions')}
                        {positions.length > 0 && <span className='app__tab-badge'>{positions.length}</span>}
                    </button>
                </div>

                {view === 'positions' ? (
                    <PositionsPanel layout='board' open onClose={() => setView('markets')} />
                ) : (
                    <>
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
                    </>
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
                    <span className='app__version' title={`Built ${__BUILD_TIME__}`}>
                        v{__APP_VERSION__}
                        {__COMMIT__ ? ` · ${__COMMIT__}` : ''}
                    </span>
                </footer>
            </div>

            <PositionsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

            <ToastHost />

            {showTutorial && <TutorialPage onClose={() => setShowTutorial(false)} />}

            {!panelOpen && (
                <button className='app__panel-toggle' onClick={() => setPanelOpen(true)}>
                    📋 {t('pt.toggle')}
                    {positions.length > 0 && <span className='app__panel-badge'>{positions.length}</span>}
                </button>
            )}
        </div>
    )
}
