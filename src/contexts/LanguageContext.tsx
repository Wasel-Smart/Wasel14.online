import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Language } from '../locales/translations';
import { interpolateSingleBrace, loadLanguageTranslations, resolve, setCurrentLang } from '../locales/tx';

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
  const [readyLanguage, setReadyLanguage] = useState<Language | null>(null);
  const [initialLoadError, setInitialLoadError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const languageRequestRef = useRef(0);

  const setLanguage = useCallback((lang: Language) => {
    const requestId = ++languageRequestRef.current;
    void loadLanguageTranslations(lang)
      .then(() => {
        if (requestId !== languageRequestRef.current) {return;}
        setCurrentLang(lang);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        setReadyLanguage(lang);
        setLanguageState(lang);
        try {
          localStorage.setItem('wasel-language', lang);
        } catch (error) {
          console.error('Failed to save language to localStorage:', error);
        }
      })
      .catch(error => {
        if (import.meta.env?.DEV) {
          console.warn('Failed to load the selected language:', error);
        }
      });
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  }, [language, setLanguage]);

  useEffect(() => {
    const requestId = ++languageRequestRef.current;
    void loadLanguageTranslations(language)
      .then(() => {
        if (requestId !== languageRequestRef.current) {return;}
        setCurrentLang(language);
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        setReadyLanguage(language);
      })
      .catch(error => {
        if (requestId !== languageRequestRef.current) {return;}
        setInitialLoadError(true);
        if (import.meta.env?.DEV) {
          console.warn('Failed to load the saved language:', error);
        }
      });

    return () => {
      if (requestId === languageRequestRef.current) {languageRequestRef.current += 1;}
    };
  }, [language, retryAttempt]);

  // Delegates to the shared resolver in locales/tx. It MUST NOT be a second,
  // hand-rolled walk of the translation table: chunks are merged into one FLAT
  // table per language (see translations.ts), so a nested-only walk resolves
  // nothing and every `t('namespace.key')` call site renders its raw key.
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string =>
      interpolateSingleBrace(resolve(key, language), params),
    [language],
  );

  const dir: LanguageContextType['dir'] = (readyLanguage ?? language) === 'ar' ? 'rtl' : 'ltr';

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

  if (!readyLanguage) {
    const isArabic = language === 'ar';
    return (
      <div
        role={initialLoadError ? 'alert' : 'status'}
        aria-live={initialLoadError ? 'assertive' : 'polite'}
        lang={isArabic ? 'ar' : 'en'}
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#081D39',
          color: '#F4F8FF',
          fontFamily: 'Cairo, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div>
          <p>{initialLoadError
            ? isArabic ? 'تعذر تحميل اللغة. تحقق من اتصالك وحاول مجدداً.' : 'Could not load the language. Check your connection and try again.'
            : isArabic ? 'جارٍ تحميل واصل…' : 'Loading Wasel…'}</p>
          {initialLoadError && (
            <button type="button" onClick={() => {
              setInitialLoadError(false);
              setRetryAttempt(attempt => attempt + 1);
            }}>
              {isArabic ? 'إعادة المحاولة' : 'Try again'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
