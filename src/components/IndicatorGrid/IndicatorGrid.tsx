import type { Indicators } from '../../types'
import { formatPrice, formatNumber } from '../../utils/format'
import { useI18n } from '../../context/I18nContext'
import './IndicatorGrid.scss'

interface IndicatorGridProps {
    indicators: Indicators
    priceDecimals: number | null
}

const emaClass = (price: number, ema: number) => (price >= ema ? 'is-bull' : 'is-bear')

const rsiZone = (rsi: number) => {
    if (rsi >= 70) return { key: 'ind.overbought', cls: 'is-bear' }
    if (rsi <= 30) return { key: 'ind.oversold', cls: 'is-bull' }
    if (rsi >= 50) return { key: 'ind.bullish', cls: 'is-bull' }
    return { key: 'ind.bearish', cls: 'is-bear' }
}

export const IndicatorGrid = ({ indicators, priceDecimals }: IndicatorGridProps) => {
    const { t } = useI18n()
    const { price, ema10, ema22, ema55, rsi, macd, smartMoney } = indicators
    const zone = rsiZone(rsi)
    const macdCls = macd.histogram >= 0 ? 'is-bull' : 'is-bear'

    return (
        <div className='indicator-grid'>
            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>RSI 14</span>
                <span className={`indicator-grid__val ${zone.cls}`}>{formatNumber(rsi, 1)}</span>
                <span className='indicator-grid__sub'>{t(zone.key)}</span>
                <div className='indicator-grid__bar'>
                    <span className='indicator-grid__bar-fill' style={{ width: `${Math.min(100, rsi)}%` }} />
                </div>
            </div>

            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>MACD</span>
                <span className={`indicator-grid__val ${macdCls}`}>{formatNumber(macd.histogram, 4)}</span>
                <span className='indicator-grid__sub'>
                    {macd.histogram >= 0 ? t('ind.momentumUp') : t('ind.momentumDown')}
                </span>
            </div>

            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>EMA 10</span>
                <span className={`indicator-grid__val ${emaClass(price, ema10)}`}>{formatPrice(ema10, priceDecimals)}</span>
                <span className='indicator-grid__sub'>{price >= ema10 ? t('ind.above') : t('ind.below')}</span>
            </div>

            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>EMA 22</span>
                <span className={`indicator-grid__val ${emaClass(price, ema22)}`}>{formatPrice(ema22, priceDecimals)}</span>
                <span className='indicator-grid__sub'>{price >= ema22 ? t('ind.above') : t('ind.below')}</span>
            </div>

            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>EMA 55</span>
                <span className={`indicator-grid__val ${emaClass(price, ema55)}`}>{formatPrice(ema55, priceDecimals)}</span>
                <span className='indicator-grid__sub'>{price >= ema55 ? t('ind.above') : t('ind.below')}</span>
            </div>

            <div className='indicator-grid__cell'>
                <span className='indicator-grid__key'>{t('ind.smartMoney')}</span>
                <span className={`indicator-grid__val is-${smartMoney.bias}`}>
                    {smartMoney.bias === 'neutral' ? t('ind.neutral') : smartMoney.bias === 'bullish' ? t('ind.bullish') : t('ind.bearish')}
                </span>
                <span className='indicator-grid__sub'>
                    {smartMoney.breakOfStructure ? t('ind.bos') : `Vol ×${formatNumber(smartMoney.volumeRatio, 1)}`}
                </span>
            </div>
        </div>
    )
}
