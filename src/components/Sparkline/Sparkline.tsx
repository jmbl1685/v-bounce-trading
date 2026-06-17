import { useMemo } from 'react'
import type { Candle } from '../../types'
import './Sparkline.scss'

interface SparklineProps {
    candles: Candle[]
    direction: 'up' | 'down' | 'flat'
    support?: number | null
    resistance?: number | null
}

const WIDTH = 100
const HEIGHT = 36

export const Sparkline = ({ candles, direction, support, resistance }: SparklineProps) => {
    const { line, area, supportY, resistanceY } = useMemo(() => {
        const closes = candles.slice(-80).map((c) => c.close)
        if (closes.length < 2) {
            return { line: '', area: '', supportY: null, resistanceY: null }
        }

        let min = Math.min(...closes)
        let max = Math.max(...closes)
        if (support) min = Math.min(min, support)
        if (resistance) max = Math.max(max, resistance)
        const span = max - min || 1

        const x = (i: number) => (i / (closes.length - 1)) * WIDTH
        const y = (v: number) => HEIGHT - ((v - min) / span) * HEIGHT

        const points = closes.map((c, i) => `${x(i).toFixed(2)},${y(c).toFixed(2)}`)
        const linePath = `M${points.join(' L')}`
        const areaPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`

        return {
            line: linePath,
            area: areaPath,
            supportY: support ? y(support) : null,
            resistanceY: resistance ? y(resistance) : null
        }
    }, [candles, support, resistance])

    const stroke =
        direction === 'up' ? 'var(--long)' : direction === 'down' ? 'var(--short)' : 'var(--text-faint)'
    const gradId = `spark-${direction}`

    if (!line) return <div className='sparkline sparkline--empty' />

    return (
        <svg
            className='sparkline'
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio='none'
            role='img'
            aria-label='price sparkline'
        >
            <defs>
                <linearGradient id={gradId} x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={stroke} stopOpacity='0.35' />
                    <stop offset='100%' stopColor={stroke} stopOpacity='0' />
                </linearGradient>
            </defs>
            {resistanceY !== null && (
                <line
                    className='sparkline__level'
                    x1='0'
                    x2={WIDTH}
                    y1={resistanceY}
                    y2={resistanceY}
                    stroke='var(--short)'
                />
            )}
            {supportY !== null && (
                <line
                    className='sparkline__level'
                    x1='0'
                    x2={WIDTH}
                    y1={supportY}
                    y2={supportY}
                    stroke='var(--long)'
                />
            )}
            <path d={area} fill={`url(#${gradId})`} />
            <path d={line} fill='none' stroke={stroke} strokeWidth='1.5' vectorEffect='non-scaling-stroke' />
        </svg>
    )
}
