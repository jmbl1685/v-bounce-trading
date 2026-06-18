import type { StrategyKind } from './types'

export interface StrategyMeta {
    id: StrategyKind
    /** Whether the strategy is live and selectable (vs. a "coming soon" stub). */
    available: boolean
    /** Number of explanation bullets in i18n (strategy.<id>.b1..bN). */
    bullets: number
}

// Order shown in the picker. Add new strategies here.
export const STRATEGIES: StrategyMeta[] = [
    { id: 'vbounce', available: true, bullets: 5 },
    { id: 'bollinger', available: true, bullets: 5 },
    { id: 'tradinglatino', available: true, bullets: 5 },
    { id: 'supertrend', available: true, bullets: 5 },
    { id: 'emapullback', available: true, bullets: 5 },
    { id: 'donchian', available: true, bullets: 5 },
    { id: 'smc', available: true, bullets: 5 },
    { id: 'stochastic', available: true, bullets: 5 }
]

const KEY = 'v-bounce-active-strategy'
const IDS = STRATEGIES.map((s) => s.id)

// Read once per page load — switching strategy reloads the app, so the cache
// can't go stale, and the signal pipeline avoids hitting localStorage per tick.
let cached: StrategyKind | null = null

export const getActiveStrategy = (): StrategyKind => {
    if (cached) return cached
    const stored = localStorage.getItem(KEY) as StrategyKind | null
    cached = stored && IDS.includes(stored) ? stored : 'vbounce'
    return cached
}

export const setActiveStrategy = (id: StrategyKind): void => {
    localStorage.setItem(KEY, id)
    cached = id
}
