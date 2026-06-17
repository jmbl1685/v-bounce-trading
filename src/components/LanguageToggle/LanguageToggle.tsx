import { useI18n } from '../../context/I18nContext'
import type { Lang } from '../../i18n/translations'
import './LanguageToggle.scss'

const LANGS: Lang[] = ['en', 'es']

export const LanguageToggle = () => {
    const { lang, setLang } = useI18n()

    return (
        <div className='lang-toggle' role='group' aria-label='Language'>
            {LANGS.map((l) => (
                <button
                    key={l}
                    type='button'
                    className={`lang-toggle__btn ${l === lang ? 'is-active' : ''}`}
                    onClick={() => setLang(l)}
                    aria-pressed={l === lang}
                >
                    {l.toUpperCase()}
                </button>
            ))}
        </div>
    )
}
