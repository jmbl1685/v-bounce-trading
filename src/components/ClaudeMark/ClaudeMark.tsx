interface ClaudeMarkProps {
    size?: number
}

const RAYS = 11
const CENTER = 12

// The Claude "spark" — a starburst of tapered rays in the brand terracotta.
export const ClaudeMark = ({ size = 16 }: ClaudeMarkProps) => {
    const rays = Array.from({ length: RAYS }, (_, i) => {
        const angle = (i / RAYS) * Math.PI * 2 - Math.PI / 2
        const len = i % 2 === 0 ? 8.6 : 6.4
        return {
            x2: (CENTER + Math.cos(angle) * len).toFixed(2),
            y2: (CENTER + Math.sin(angle) * len).toFixed(2)
        }
    })

    return (
        <svg width={size} height={size} viewBox='0 0 24 24' aria-hidden>
            {rays.map((r, i) => (
                <line
                    key={i}
                    x1={CENTER}
                    y1={CENTER}
                    x2={r.x2}
                    y2={r.y2}
                    stroke='#d97757'
                    strokeWidth='2.3'
                    strokeLinecap='round'
                />
            ))}
        </svg>
    )
}
