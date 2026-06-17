/**
 * Format a price. When `decimals` is provided (from the symbol's tick size) it
 * is authoritative; otherwise fall back to a magnitude-based heuristic.
 */
export const formatPrice = (
    value: number | null | undefined,
    decimals?: number | null
): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—'
    let digits: number
    if (decimals !== null && decimals !== undefined) {
        digits = decimals
    } else {
        const abs = Math.abs(value)
        digits = 2
        if (abs < 0.1) digits = 6
        else if (abs < 1) digits = 5
        else if (abs < 100) digits = 4
        else if (abs < 1000) digits = 3
    }
    return value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })
}

/** Compact number formatting (1.2K, 3.4M). */
export const formatCompact = (value: number): string => {
    if (Number.isNaN(value)) return '—'
    return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export const formatPct = (value: number): string => {
    if (Number.isNaN(value)) return '—'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
}

export const formatNumber = (value: number, digits = 2): string => {
    if (Number.isNaN(value)) return '—'
    return value.toFixed(digits)
}

/** Opened day + hour, localized — e.g. "Jun 17, 14:32". */
export const formatOpenedAt = (ts: number, locale = 'en-US'): string => {
    if (!ts || Number.isNaN(ts)) return '—'
    return new Date(ts).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

/** Compact elapsed duration since `ms` milliseconds ago — e.g. "5m", "2h", "3d". */
export const formatAgo = (ms: number): string => {
    const s = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(s / 60)
    if (m < 60) return `${Math.max(1, m)}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
}

/** USD/USDT amount with thousands separators, e.g. 10000 → "10,000.00". */
export const formatUsd = (value: number, digits = 2): string => {
    if (Number.isNaN(value)) return '—'
    return value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })
}
