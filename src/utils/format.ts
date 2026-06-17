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

/** USD/USDT amount with thousands separators, e.g. 10000 → "10,000.00". */
export const formatUsd = (value: number, digits = 2): string => {
    if (Number.isNaN(value)) return '—'
    return value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })
}
