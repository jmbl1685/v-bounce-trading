import { useCallback, useEffect, useState } from 'react'
import type { Credentials, RealPosition } from '../services/binanceTrade'
import { getUsdtBalance, getPositions } from '../services/binanceTrade'

interface RealAccount {
    balance: number | null
    positions: RealPosition[]
    error: string | null
    loading: boolean
    refresh: () => void
}

// Visible tab: a steady poll. Hidden tab (backgrounded): poll far less often so
// idle/background tabs don't burn through the Binance IP request-weight budget.
const POLL_VISIBLE = 5000
const POLL_HIDDEN = 20000

/** Poll the live Binance futures account (balance + positions) while active. */
export const useRealAccount = (active: boolean, creds: Credentials | null): RealAccount => {
    const [balance, setBalance] = useState<number | null>(null)
    const [positions, setPositions] = useState<RealPosition[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const refresh = useCallback(async () => {
        if (!active || !creds) return
        setLoading(true)
        try {
            const [b, p] = await Promise.all([getUsdtBalance(creds), getPositions(creds)])
            setBalance(b)
            setPositions(p)
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setLoading(false)
        }
    }, [active, creds])

    useEffect(() => {
        if (!active || !creds) {
            setBalance(null)
            setPositions([])
            return
        }

        let timer = 0
        let stopped = false
        const tick = async () => {
            await refresh()
            if (stopped) return
            timer = window.setTimeout(tick, document.hidden ? POLL_HIDDEN : POLL_VISIBLE)
        }
        tick()

        // Refresh promptly when the tab is brought back to the foreground.
        const onVisible = () => {
            if (!document.hidden && !stopped) {
                window.clearTimeout(timer)
                tick()
            }
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            stopped = true
            window.clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [active, creds, refresh])

    return { balance, positions, error, loading, refresh }
}
