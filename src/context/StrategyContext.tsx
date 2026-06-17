import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_PARAMS, type StrategyParams } from '../indicators/params'

interface StrategyContextValue {
    /** Saved params for a symbol, or the defaults when none are saved. */
    getParams: (symbol: string) => StrategyParams
    /** True when the symbol has its own saved (non-default) params. */
    isCustom: (symbol: string) => boolean
    saveParams: (symbol: string, params: StrategyParams) => void
    clearParams: (symbol: string) => void
}

const StrategyContext = createContext<StrategyContextValue | null>(null)

const STORAGE_KEY = 'v-bounce-strategy-params'

type ParamMap = Record<string, StrategyParams>

const load = (): ParamMap => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch {
        /* ignore */
    }
    return {}
}

export const StrategyProvider = ({ children }: { children: ReactNode }) => {
    const [map, setMap] = useState<ParamMap>(load)

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    }, [map])

    const getParams = useCallback((symbol: string) => map[symbol] ?? DEFAULT_PARAMS, [map])
    const isCustom = useCallback((symbol: string) => symbol in map, [map])

    const saveParams = useCallback((symbol: string, params: StrategyParams) => {
        setMap((m) => ({ ...m, [symbol]: params }))
    }, [])

    const clearParams = useCallback((symbol: string) => {
        setMap((m) => {
            if (!(symbol in m)) return m
            const next = { ...m }
            delete next[symbol]
            return next
        })
    }, [])

    const value = useMemo(
        () => ({ getParams, isCustom, saveParams, clearParams }),
        [getParams, isCustom, saveParams, clearParams]
    )

    return <StrategyContext.Provider value={value}>{children}</StrategyContext.Provider>
}

export const useStrategy = (): StrategyContextValue => {
    const ctx = useContext(StrategyContext)
    if (!ctx) throw new Error('useStrategy must be used within StrategyProvider')
    return ctx
}
