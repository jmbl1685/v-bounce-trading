import { useEffect, useMemo, useState } from 'react'
import type { Interval } from '../../types'
import { symbolExists } from '../../services/binanceRest'
import { fetchDirectory, searchDirectory, type DirSort, type MarketInfo } from '../../services/binanceDirectory'
import { AssetLogo } from '../AssetLogo/AssetLogo'
import { useI18n } from '../../context/I18nContext'
import { formatPrice, formatPct } from '../../utils/format'
import './AddAssetForm.scss'

interface AddAssetFormProps {
    interval: Interval
    existing: string[]
    onAdd: (symbol: string) => void
    onIntervalChange: (interval: Interval) => void
}

const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h']
const QUICK = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

const normalize = (raw: string) => {
    const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!s) return ''
    return /USDT$|BUSD$|USDC$/.test(s) ? s : `${s}USDT`
}

export const AddAssetForm = ({ interval, existing, onAdd, onIntervalChange }: AddAssetFormProps) => {
    const { t } = useI18n()
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [checking, setChecking] = useState(false)
    const [directory, setDirectory] = useState<MarketInfo[] | null>(null)
    const [focused, setFocused] = useState(false)
    const [sort, setSort] = useState<DirSort>('vol')

    useEffect(() => {
        let active = true
        fetchDirectory().then((d) => active && setDirectory(d))
        return () => {
            active = false
        }
    }, [])

    const results = useMemo(
        () => (directory ? searchDirectory(directory, value, sort) : []),
        [directory, value, sort]
    )

    const SORTS: { key: DirSort; label: string }[] = [
        { key: 'vol', label: t('addAsset.sortVol') },
        { key: 'gainers', label: t('addAsset.sortGainers') },
        { key: 'losers', label: t('addAsset.sortLosers') }
    ]

    const submit = async (raw: string) => {
        const symbol = normalize(raw)
        if (!symbol) {
            setError(t('addAsset.errEnter'))
            return
        }
        if (existing.includes(symbol)) {
            setError(t('addAsset.errExists', { sym: symbol }))
            return
        }
        setChecking(true)
        setError(null)
        const ok = await symbolExists(symbol)
        setChecking(false)
        if (!ok) {
            setError(t('addAsset.errInvalid', { sym: symbol }))
            return
        }
        onAdd(symbol)
        setValue('')
        setFocused(false)
    }

    const pick = (symbol: string) => {
        if (!existing.includes(symbol)) onAdd(symbol)
        setValue('')
        setError(null)
        setFocused(false)
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        submit(value)
    }

    const availableQuick = QUICK.filter((s) => !existing.includes(s))
    const showDropdown = focused

    return (
        <form className='add-asset' onSubmit={onSubmit} autoComplete='off'>
            <div className='add-asset__row'>
                <div className='add-asset__field'>
                    <input
                        className='add-asset__input'
                        placeholder={t('addAsset.placeholder')}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value)
                            setError(null)
                        }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
                        spellCheck={false}
                        autoComplete='off'
                    />
                    <button className='add-asset__submit' type='submit' disabled={checking}>
                        {checking ? t('addAsset.checking') : t('addAsset.add')}
                    </button>

                    {showDropdown && (
                        <div className='add-asset__results'>
                            {directory && (
                                <div className='add-asset__results-head' onMouseDown={(e) => e.preventDefault()}>
                                    <div className='add-asset__sorts'>
                                        {SORTS.map((s) => (
                                            <button
                                                key={s.key}
                                                type='button'
                                                className={`add-asset__sort ${sort === s.key ? 'is-active' : ''}`}
                                                onClick={() => setSort(s.key)}
                                            >
                                                {s.key === 'gainers' ? '▲ ' : s.key === 'losers' ? '▼ ' : ''}
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className='add-asset__results-count'>
                                        {t('addAsset.count', { n: results.length })}
                                    </span>
                                </div>
                            )}
                            {!directory ? (
                                <div className='add-asset__results-msg'>{t('addAsset.loading')}</div>
                            ) : results.length === 0 ? (
                                <div className='add-asset__results-msg'>{t('addAsset.noResults')}</div>
                            ) : (
                                results.map((m) => {
                                    const added = existing.includes(m.symbol)
                                    return (
                                        <button
                                            key={m.symbol}
                                            type='button'
                                            className={`add-asset__result ${added ? 'is-added' : ''}`}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => pick(m.symbol)}
                                        >
                                            <AssetLogo symbol={m.base} size={26} />
                                            <span className='add-asset__result-sym'>
                                                {m.base}
                                                <i>{m.symbol.replace(m.base, '')}</i>
                                            </span>
                                            <span className='add-asset__result-price'>
                                                {formatPrice(m.lastPrice, m.decimals)}
                                            </span>
                                            <span
                                                className={`add-asset__result-chg ${m.changePct >= 0 ? 'is-up' : 'is-down'}`}
                                            >
                                                {formatPct(m.changePct)}
                                            </span>
                                            {added && <span className='add-asset__result-added'>✓ {t('addAsset.added')}</span>}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                <div className='add-asset__intervals' role='group' aria-label='Timeframe'>
                    {INTERVALS.map((iv) => (
                        <button
                            key={iv}
                            type='button'
                            className={`add-asset__interval ${iv === interval ? 'is-active' : ''}`}
                            onClick={() => onIntervalChange(iv)}
                        >
                            {iv}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className='add-asset__error'>{error}</p>}

            {availableQuick.length > 0 && (
                <div className='add-asset__quick'>
                    <span className='add-asset__quick-label'>{t('addAsset.quickAdd')}</span>
                    {availableQuick.map((s) => (
                        <button key={s} type='button' className='add-asset__chip' onClick={() => pick(s)}>
                            {s.replace('USDT', '')}
                        </button>
                    ))}
                </div>
            )}
        </form>
    )
}
