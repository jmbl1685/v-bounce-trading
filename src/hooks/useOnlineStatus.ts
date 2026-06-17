import { useEffect, useState } from 'react'

/** Tracks the browser's network connectivity for a global connection badge. */
export const useOnlineStatus = (): boolean => {
    const [online, setOnline] = useState(() => navigator.onLine)

    useEffect(() => {
        const goOnline = () => setOnline(true)
        const goOffline = () => setOnline(false)
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    return online
}
