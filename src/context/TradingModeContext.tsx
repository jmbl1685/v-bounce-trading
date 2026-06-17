import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Credentials } from '../services/binanceTrade'

export type TradeMode = 'demo' | 'real'

interface TradingModeValue {
    mode: TradeMode
    credentials: Credentials | null
    hasCredentials: boolean
    setMode: (mode: TradeMode) => void
    saveCredentials: (c: Credentials) => void
    clearCredentials: () => void
}

const TradingModeContext = createContext<TradingModeValue | null>(null)

const KEY = 'v-bounce-binance-keys'
const MODE_KEY = 'v-bounce-trade-mode'

const loadCreds = (): Credentials | null => {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
            const c = JSON.parse(raw)
            if (c?.apiKey && c?.secretKey) return { apiKey: c.apiKey, secretKey: c.secretKey, testnet: !!c.testnet }
        }
    } catch {
        /* ignore */
    }
    return null
}

export const TradingModeProvider = ({ children }: { children: ReactNode }) => {
    const [credentials, setCredentials] = useState<Credentials | null>(loadCreds)
    const [mode, setModeState] = useState<TradeMode>(() =>
        localStorage.getItem(MODE_KEY) === 'real' && loadCreds() ? 'real' : 'demo'
    )

    useEffect(() => {
        localStorage.setItem(MODE_KEY, mode)
    }, [mode])

    const saveCredentials = useCallback((c: Credentials) => {
        localStorage.setItem(KEY, JSON.stringify(c))
        setCredentials(c)
    }, [])

    const clearCredentials = useCallback(() => {
        localStorage.removeItem(KEY)
        setCredentials(null)
        setModeState('demo')
    }, [])

    const setMode = useCallback(
        (m: TradeMode) => {
            // Real mode requires saved credentials.
            if (m === 'real' && !credentials) return
            setModeState(m)
        },
        [credentials]
    )

    const value = useMemo(
        () => ({
            mode,
            credentials,
            hasCredentials: credentials !== null,
            setMode,
            saveCredentials,
            clearCredentials
        }),
        [mode, credentials, setMode, saveCredentials, clearCredentials]
    )

    return <TradingModeContext.Provider value={value}>{children}</TradingModeContext.Provider>
}

export const useTradingMode = (): TradingModeValue => {
    const ctx = useContext(TradingModeContext)
    if (!ctx) throw new Error('useTradingMode must be used within TradingModeProvider')
    return ctx
}
