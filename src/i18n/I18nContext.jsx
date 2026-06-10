import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, format, LANGUAGES } from './translations.js';

const STORAGE_KEY = 'df.lang';

const I18nContext = createContext(null);

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
  } catch { /* ignore */ }
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('ru')) return 'ru';
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => detectInitial());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (translations[next]) setLangState(next);
  }, []);

  const t = useCallback((key, vars) => {
    const table = translations[lang] || translations.en;
    const raw = table[key] ?? translations.en[key] ?? key;
    return vars ? format(raw, vars) : raw;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
