import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTradingMode } from '../../context/TradingModeContext'
import { useI18n } from '../../context/I18nContext'
import { getUsdtBalance } from '../../services/binanceTrade'
import { formatUsd } from '../../utils/format'
import './CredentialsModal.scss'

interface CredentialsModalProps {
    onClose: () => void
}

export const CredentialsModal = ({ onClose }: CredentialsModalProps) => {
    const { t } = useI18n()
    const { credentials, saveCredentials, clearCredentials, setMode } = useTradingMode()
    const [apiKey, setApiKey] = useState(credentials?.apiKey ?? '')
    const [secretKey, setSecretKey] = useState(credentials?.secretKey ?? '')
    const [testnet, setTestnet] = useState(credentials?.testnet ?? false)
    const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
    const [message, setMessage] = useState<string | null>(null)

    const connect = async () => {
        if (!apiKey.trim() || !secretKey.trim()) {
            setStatus('error')
            setMessage(t('keys.errEmpty'))
            return
        }
        const creds = { apiKey: apiKey.trim(), secretKey: secretKey.trim(), testnet }
        setStatus('checking')
        setMessage(null)
        try {
            const balance = await getUsdtBalance(creds)
            saveCredentials(creds)
            setMode('real')
            setStatus('ok')
            setMessage(t('keys.connected', { bal: formatUsd(balance, 2) }))
        } catch (err) {
            setStatus('error')
            setMessage(err instanceof Error ? err.message : String(err))
        }
    }

    const disconnect = () => {
        clearCredentials()
        setApiKey('')
        setSecretKey('')
        setStatus('idle')
        setMessage(null)
    }

    return createPortal(
        <div className='creds' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='creds__panel' onClick={(e) => e.stopPropagation()}>
                <header className='creds__head'>
                    <h3>{t('keys.title')}</h3>
                    <button className='creds__close' onClick={onClose} aria-label='Close'>
                        ✕
                    </button>
                </header>

                <div className='creds__warn'>⚠ {t('keys.warning')}</div>

                <label className='creds__field'>
                    <span>{t('keys.apiKey')}</span>
                    <input
                        type='text'
                        autoComplete='off'
                        spellCheck={false}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder='••••••••'
                    />
                </label>
                <label className='creds__field'>
                    <span>{t('keys.secretKey')}</span>
                    <input
                        type='password'
                        autoComplete='off'
                        spellCheck={false}
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder='••••••••'
                    />
                </label>

                <label className='creds__testnet'>
                    <input type='checkbox' checked={testnet} onChange={(e) => setTestnet(e.target.checked)} />
                    {t('keys.testnet')}
                </label>

                {message && <p className={`creds__msg creds__msg--${status}`}>{message}</p>}

                <div className='creds__actions'>
                    <button className='creds__connect' onClick={connect} disabled={status === 'checking'}>
                        {status === 'checking' ? t('keys.checking') : t('keys.connect')}
                    </button>
                    {credentials && (
                        <button className='creds__disconnect' onClick={disconnect}>
                            {t('keys.disconnect')}
                        </button>
                    )}
                </div>

                <p className='creds__hint'>{t('keys.hint')}</p>
            </div>
        </div>,
        document.body
    )
}
