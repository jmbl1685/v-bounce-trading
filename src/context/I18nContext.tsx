import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { translations, type Lang } from '../i18n/translations'

type Vars = Record<string, string | number>

interface I18nContextValue {
    lang: Lang
    setLang: (lang: Lang) => void
    /** Translate a key, interpolating {placeholders} from `vars`. */
    t: (key: string, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'v-bounce-lang'

const getInitialLang = (): Lang => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
    return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const interpolate = (str: string, vars?: Vars): string => {
    if (!vars) return str
    return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [lang, setLang] = useState<Lang>(getInitialLang)

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, lang)
        document.documentElement.setAttribute('lang', lang)
    }, [lang])

    const t = useCallback(
        (key: string, vars?: Vars) => {
            const str = translations[lang][key] ?? translations.en[key] ?? key
            return interpolate(str, vars)
        },
        [lang]
    )

    const value = useMemo(() => ({ lang, setLang, t }), [lang, t])

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = (): I18nContextValue => {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error('useI18n must be used within I18nProvider')
    return ctx
}
