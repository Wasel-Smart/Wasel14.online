// Initial locale bootstrap — loaded synchronously before the app bundle.
//
// The resolution rule MUST match LanguageProvider (src/contexts/LanguageContext.tsx):
// Arabic is the default; only an explicit saved "en" selects English.
//
// This script also applies <html lang> and <html dir> before first paint so
// Arabic visitors never see an LTR flash followed by a layout flip when React
// mounts (which was a source of layout shift and wrong screen-reader language).
(function () {
  var locale = 'ar';
  try {
    var stored = null;
    try {
      stored = localStorage.getItem('wasel-language');
    } catch (e) {
      stored = null;
    }
    locale = stored === 'en' ? 'en' : 'ar';
  } catch (e) {
    locale = 'ar';
  }

  window.__wasel_initial_locale = locale;

  try {
    var root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {
    // Non-fatal: LanguageProvider applies the same attributes after mount.
  }
})();
