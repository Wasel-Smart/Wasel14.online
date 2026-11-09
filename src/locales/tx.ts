import type { Language, TranslationNode } from './translations';

let currentLang: Language = 'ar';

const loadedTranslations: Partial<Record<Language, TranslationNode>> = {};
const pendingTranslations: Partial<Record<Language, Promise<void>>> = {};

export function loadLanguageTranslations(language: Language): Promise<void> {
  if (loadedTranslations[language]) {return Promise.resolve();}
  const pending = pendingTranslations[language];
  if (pending) {return pending;}

  const loading = (language === 'ar'
    ? import('./languages/ar.json')
    : import('./languages/en.json'))
    .then(module => {
      loadedTranslations[language] = module.default as TranslationNode;
    })
    .finally(() => {
      delete pendingTranslations[language];
    });
  pendingTranslations[language] = loading;
  return loading;
}

export function setCurrentLang(lang: Language): void {
  currentLang = lang;
}

export function getCurrentLang(): Language {
  return currentLang;
}

// Chunk objects (see ./chunks/*) are merged into a single flat table per
// language in translations.ts â€” the chunk name (e.g. "waselAuth", "common")
// is organisational only and is NOT a nesting level in the merged table.
// Call sites across the app still address strings as "namespace.key"
// (e.g. tx('waselAuth.one_identity'), tx('common.email')), so resolution
// must try both forms: a direct nested walk (in case a namespace is ever
// nested for real) and, as the primary path today, the flat lookup using
// just the final segment of the dotted key.
function lookup(key: string, lang: Language): string | undefined {
  const keys = key.split('.');

  const table = loadedTranslations[lang];
  if (!table) {return undefined;}

  let nested: TranslationNode | undefined = table;
  for (const k of keys) {
    nested = typeof nested === 'object' && nested !== null ? nested[k] : undefined;
  }
  if (typeof nested === 'string') {return nested;}

  if (keys.length > 1) {
    const tail = keys[keys.length - 1];
    if (!tail) {return undefined;}
    const flatValue =
      typeof table === 'object' && table !== null
        ? (table as Record<string, unknown>)[tail]
        : undefined;
    if (typeof flatValue === 'string') {return flatValue;}
  }

  return undefined;
}

export function tx(key: string, params?: Record<string, string | number>): string {
  return interpolate(resolve(key, currentLang), params);
}

/**
 * Language-agnostic key resolution, with the other-language fallback.
 *
 * `tx()` resolves against the module-level `currentLang`; this variant takes the
 * language explicitly so `useLanguage().t` can share ONE resolver instead of
 * reimplementing (and slowly diverging from) the flat-table fallback in `lookup`.
 *
 * Interpolation is left to the caller because the two entry points use
 * different placeholder syntax: `tx` fills `{{name}}`, `t` fills `{name}`.
 */
export function resolve(key: string, lang: Language): string {
  const direct = lookup(key, lang);
  if (direct !== undefined) {return direct;}

  const fallbackLang: Language = lang === 'en' ? 'ar' : 'en';
  return lookup(key, fallbackLang) ?? key;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (typeof template !== 'string' || !params) {return template;}
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{{${name}}}`,
  );
}

/**
 * `t()`-style interpolation for the single-brace `{name}` placeholders used by
 * the settings/messaging chunks (e.g. `'Ready for {phone}'`).
 */
export function interpolateSingleBrace(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (typeof template !== 'string' || !params) {return template;}
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

