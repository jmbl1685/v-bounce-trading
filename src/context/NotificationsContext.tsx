import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

interface NotifyOptions {
    body: string
    tag: string
}

interface Settings {
    enabled: boolean
    sound: boolean
    minConfidence: number
    muted: string[]
}

interface NotificationsValue {
    supported: boolean
    permission: Permission
    enabled: boolean
    sound: boolean
    minConfidence: number
    muted: string[]
    enable: () => Promise<void>
    disable: () => void
    setSound: (on: boolean) => void
    setMinConfidence: (v: number) => void
    toggleMuted: (symbol: string) => void
    /** Whether an alert should fire for this symbol at this confidence. */
    shouldAlert: (symbol: string, confidence: number) => boolean
    notify: (title: string, options: NotifyOptions) => void
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

const KEY = 'v-bounce-notifications'
const supported = typeof window !== 'undefined' && 'Notification' in window

const DEFAULTS: Settings = { enabled: false, sound: true, minConfidence: 60, muted: [] }

const load = (): Settings => {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {
        /* ignore */
    }
    return DEFAULTS
}

// A short two-tone chime via Web Audio (no asset file needed).
let audioCtx: AudioContext | null = null
const primeAudio = () => {
    try {
        audioCtx =
            audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)()
        if (audioCtx.state === 'suspended') audioCtx.resume()
    } catch {
        /* ignore */
    }
}
const playChime = () => {
    try {
        if (!audioCtx) return
        const t = audioCtx.currentTime
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.setValueAtTime(1320, t + 0.11)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
        osc.start(t)
        osc.stop(t + 0.33)
    } catch {
        /* ignore */
    }
}

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
    const initial = useMemo(load, [])
    const [permission, setPermission] = useState<Permission>(supported ? Notification.permission : 'unsupported')
    const [settings, setSettings] = useState<Settings>(initial)
    const swRef = useRef<ServiceWorkerRegistration | null>(null)

    useEffect(() => {
        if (!supported || !('serviceWorker' in navigator)) return
        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {
                swRef.current = reg
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        localStorage.setItem(KEY, JSON.stringify(settings))
    }, [settings])

    const enable = useCallback(async () => {
        if (!supported) return
        primeAudio() // running inside the click gesture lets audio play later
        const result = await Notification.requestPermission()
        setPermission(result)
        setSettings((s) => ({ ...s, enabled: result === 'granted' }))
    }, [])

    const disable = useCallback(() => setSettings((s) => ({ ...s, enabled: false })), [])
    const setSound = useCallback((on: boolean) => {
        if (on) primeAudio()
        setSettings((s) => ({ ...s, sound: on }))
    }, [])
    const setMinConfidence = useCallback((v: number) => setSettings((s) => ({ ...s, minConfidence: v })), [])
    const toggleMuted = useCallback(
        (symbol: string) =>
            setSettings((s) => ({
                ...s,
                muted: s.muted.includes(symbol) ? s.muted.filter((x) => x !== symbol) : [...s.muted, symbol]
            })),
        []
    )

    const shouldAlert = useCallback(
        (symbol: string, confidence: number) =>
            supported &&
            settings.enabled &&
            Notification.permission === 'granted' &&
            confidence >= settings.minConfidence &&
            !settings.muted.includes(symbol),
        [settings]
    )

    const notify = useCallback(
        (title: string, options: NotifyOptions) => {
            if (!supported || !settings.enabled || Notification.permission !== 'granted') return
            const opts: NotificationOptions = { body: options.body, tag: options.tag, icon: '/signal.svg', badge: '/signal.svg' }
            try {
                if (swRef.current) swRef.current.showNotification(title, opts)
                else new Notification(title, opts)
            } catch {
                /* ignore */
            }
            if (settings.sound) playChime()
        },
        [settings.enabled, settings.sound]
    )

    const value = useMemo(
        () => ({
            supported,
            permission,
            enabled: settings.enabled,
            sound: settings.sound,
            minConfidence: settings.minConfidence,
            muted: settings.muted,
            enable,
            disable,
            setSound,
            setMinConfidence,
            toggleMuted,
            shouldAlert,
            notify
        }),
        [permission, settings, enable, disable, setSound, setMinConfidence, toggleMuted, shouldAlert, notify]
    )

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export const useNotifications = (): NotificationsValue => {
    const ctx = useContext(NotificationsContext)
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
    return ctx
}
