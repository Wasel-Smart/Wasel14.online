/**
 * Route-level fallback copy (loading / 404 / route error) used by wasel-routes.tsx.
 *
 * Keys are prefixed with `routeFallback_` because chunks are merged into ONE flat
 * table per language (see translations.ts) — unprefixed keys like `go_home` could
 * silently collide with another chunk.
 */
export const routeFallback = {
  en: {
    routeFallback_loading_eyebrow: 'Loading',
    routeFallback_loading_title: 'Opening the next Wasel view',
    routeFallback_loading_description:
      'We are preparing the route, loading the screen data, and restoring your last context.',
    routeFallback_404_title: 'Page not found',
    routeFallback_404_description: 'The page you requested is unavailable or the link is outdated.',
    routeFallback_back_to_wasel: 'Back to Wasel',
    routeFallback_error_eyebrow: 'App Error',
    routeFallback_error_title: 'This page could not be loaded',
    routeFallback_error_default_message: 'This page could not be loaded.',
    routeFallback_find_ride: 'Find a ride',
    routeFallback_go_home: 'Go home',
    routeFallback_hook_footer: 'Invalid hook call detected. Automatically recovering...',
    routeFallback_reload_footer:
      'If this repeats, reload the app shell or reopen the flow from the home screen.',
  },
  ar: {
    routeFallback_loading_eyebrow: 'تحميل',
    routeFallback_loading_title: 'نفتح شاشة واصل التالية',
    routeFallback_loading_description:
      'نجهز المسار ونحمل بيانات الشاشة ونستعيد آخر سياق لك.',
    routeFallback_404_title: 'الصفحة غير موجودة',
    routeFallback_404_description: 'الصفحة المطلوبة غير متاحة أو أن الرابط قديم.',
    routeFallback_back_to_wasel: 'العودة إلى واصل',
    routeFallback_error_eyebrow: 'خطأ في التطبيق',
    routeFallback_error_title: 'تعذر تحميل هذه الصفحة',
    routeFallback_error_default_message: 'تعذر تحميل هذه الصفحة.',
    routeFallback_find_ride: 'ابحث عن مشوار',
    routeFallback_go_home: 'العودة للرئيسية',
    routeFallback_hook_footer: 'تم اكتشاف خطأ في استدعاء Hook. جارٍ إعادة تشغيل التطبيق تلقائياً...',
    routeFallback_reload_footer:
      'إذا تكرر هذا، فأعد تحميل التطبيق أو افتح التدفق مرة أخرى من الشاشة الرئيسية.',
  },
} as const;
