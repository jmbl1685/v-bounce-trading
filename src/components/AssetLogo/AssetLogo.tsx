import { useMemo, useState } from 'react'
import './AssetLogo.scss'

interface AssetLogoProps {
    /** Base asset, e.g. 'BTC', '1000PEPE'. */
    symbol: string
    size?: number
}

// Strip a leading multiplier prefix (1000PEPE → PEPE) so the icon resolves.
const iconKey = (symbol: string) => symbol.replace(/^[0-9]+/, '').toLowerCase()

const buildSources = (symbol: string): string[] => {
    const key = iconKey(symbol)
    if (!key) return []
    return [
        `https://assets.coincap.io/assets/icons/${key}@2x.png`,
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${key}.svg`
    ]
}

// Deterministic hue so each coin's fallback monogram has a stable colour.
const hueFromSymbol = (symbol: string): number => {
    let hash = 0
    for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) % 360
    return hash
}

export const AssetLogo = ({ symbol, size = 36 }: AssetLogoProps) => {
    const sources = useMemo(() => buildSources(symbol), [symbol])
    const [index, setIndex] = useState(0)

    const dimension = { width: size, height: size }

    if (index >= sources.length) {
        const hue = hueFromSymbol(symbol)
        const mono = (iconKey(symbol) || symbol).slice(0, 3).toUpperCase()
        return (
            <span
                className='asset-logo asset-logo--mono'
                style={{
                    ...dimension,
                    fontSize: size * 0.32,
                    background: `linear-gradient(135deg, hsl(${hue} 68% 55%), hsl(${(hue + 40) % 360} 68% 45%))`
                }}
                aria-label={`${symbol} logo`}
            >
                {mono}
            </span>
        )
    }

    return (
        <img
            className='asset-logo'
            src={sources[index]}
            style={dimension}
            alt={`${symbol} logo`}
            loading='lazy'
            onError={() => setIndex((i) => i + 1)}
        />
    )
}
