import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
    id: number
    variant: ToastVariant
    title: string
    message?: string
}

interface ToastApi {
    toasts: ToastItem[]
    push: (toast: Omit<ToastItem, 'id'>) => void
    dismiss: (id: number) => void
}

const Ctx = createContext<ToastApi | null>(null)

// How long each variant lingers before auto-dismissing. Errors stay longer so
// the Binance message is readable; they can also be dismissed manually.
const TTL: Record<ToastVariant, number> = { success: 4200, info: 4200, error: 8000 }

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const idRef = useRef(0)

    const dismiss = useCallback((id: number) => {
        setToasts((list) => list.filter((t) => t.id !== id))
    }, [])

    const push = useCallback(
        (toast: Omit<ToastItem, 'id'>) => {
            const id = ++idRef.current
            setToasts((list) => [...list, { ...toast, id }])
            window.setTimeout(() => dismiss(id), TTL[toast.variant])
        },
        [dismiss]
    )

    return <Ctx.Provider value={{ toasts, push, dismiss }}>{children}</Ctx.Provider>
}

export const useToast = (): ToastApi => {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error('useToast must be used within a ToastProvider')
    return ctx
}

/** Durations exposed so the host can sync its progress-bar animation. */
export const TOAST_TTL = TTL
