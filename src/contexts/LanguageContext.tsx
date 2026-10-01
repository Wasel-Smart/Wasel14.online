import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { Language } from '../locales/translations';
import { interpolateSingleBrace, resolve, setCurrentLang } from '../locales/tx';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('wasel-language');
      return (saved === 'en' ? 'en' : 'ar') as Language;
    } catch (error) {
      console.error('Failed to load language from localStorage:', error);
      return 'ar';
    }
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Defer localStorage write to avoid blocking render (e.g. Safari private mode)
    setTimeout(() => {
      try {
        localStorage.setItem('wasel-language', lang);
      } catch (error) {
        console.error('Failed to save language to localStorage:', error);
      }
    }, 0);

    // Update HTML dir attribute
    setCurrentLang(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  }, [language, setLanguage]);

  useEffect(() => {
    // Set initial dir attribute
    setCurrentLang(language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Delegates to the shared resolver in locales/tx. It MUST NOT be a second,
  // hand-rolled walk of the translation table: chunks are merged into one FLAT
  // table per language (see translations.ts), so a nested-only walk resolves
  // nothing and every `t('namespace.key')` call site renders its raw key.
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string =>
      interpolateSingleBrace(resolve(key, language), params),
    [language],
  );

  const dir: LanguageContextType['dir'] = language === 'ar' ? 'rtl' : 'ltr';

  // Memoize the context value
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      dir,
    }),
    [language, setLanguage, toggleLanguage, t, dir],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
