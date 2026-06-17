// Branded cursors. Chromium does not support SVG image cursors, so we draw the
// SVG shapes to a canvas and use the resulting PNG — which every engine accepts.
// The colour comes from the --cursor-color CSS variable (set from the Sass
// $cursor-color token), so updating that one value recolours both cursors.

// SVG coordinate space, and the on-screen pixel size to render the cursor at.
const VIEWBOX = 28
const CURSOR_SIZE = 25
const SCALE = CURSOR_SIZE / VIEWBOX

// Hotspots in SVG units (arrow tip / hand fingertip), scaled to the PNG.
const ARROW_HOTSPOT = { x: 3, y: 2 }
const HAND_HOTSPOT = { x: 10, y: 4 }
const hot = (p: { x: number; y: number }) =>
    `${Math.round(p.x * SCALE)} ${Math.round(p.y * SCALE)}`

const arrowSvg = (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>` +
    `<path d='M3 2 L3 21 L8 16.5 L11 23 L13.5 22 L10.6 15.8 L17 15.5 Z' ` +
    `fill='${color}' stroke='white' stroke-width='1.4' stroke-linejoin='round'/></svg>`

const handSvg = (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>` +
    `<g fill='${color}' stroke='white' stroke-width='1.1' stroke-linejoin='round'>` +
    `<rect x='8' y='12.5' width='11.5' height='10.5' rx='4'/>` +
    `<rect x='11.4' y='10.8' width='2.9' height='5' rx='1.45'/>` +
    `<rect x='13.9' y='10.2' width='2.9' height='5.5' rx='1.45'/>` +
    `<rect x='16.3' y='11.2' width='2.7' height='5' rx='1.35'/>` +
    `<rect x='6' y='14.5' width='2.9' height='5.6' rx='1.45' transform='rotate(-22 7.45 17.3)'/>` +
    `<rect x='8.7' y='4' width='3.2' height='11' rx='1.6'/></g></svg>`

const rasterize = (svg: string, size: number): Promise<string | null> =>
    new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(null)
                return
            }
            ctx.drawImage(img, 0, 0, size, size)
            try {
                resolve(canvas.toDataURL('image/png'))
            } catch {
                resolve(null)
            }
        }
        img.onerror = () => resolve(null)
        img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
    })

/**
 * Generate the PNG cursors from the current --cursor-color and inject the rules.
 * Falls back silently to the keyword cursors if rasterisation is unavailable.
 */
export const initCursors = async () => {
    const root = document.documentElement
    const color = getComputedStyle(root).getPropertyValue('--cursor-color').trim() || '#29ceef'

    const [arrow, hand] = await Promise.all([
        rasterize(arrowSvg(color), CURSOR_SIZE),
        rasterize(handSvg(color), CURSOR_SIZE)
    ])
    if (!arrow || !hand) return

    const style = document.getElementById('branded-cursors') ?? document.createElement('style')
    style.id = 'branded-cursors'
    style.textContent =
        `body{cursor:url("${arrow}") ${hot(ARROW_HOTSPOT)},auto}` +
        `a,button,summary,select,label[for],[role='button'],[role='tab']{cursor:url("${hand}") ${hot(HAND_HOTSPOT)},pointer}` +
        `input[type='text'],input:not([type]),textarea{cursor:text}` +
        `button:disabled{cursor:not-allowed}`
    document.head.appendChild(style)
}
