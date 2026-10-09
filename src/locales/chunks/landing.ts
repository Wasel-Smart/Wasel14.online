// FLAT keys only. tx() and t() both resolve a dotted key by walking the nested
// table first and then falling back to a FLAT table keyed on the FINAL segment
// alone (see locales/tx.ts). This chunk used to be nested (hero/features/
// services/cta/stats), which is the only shape in src/locales/chunks that the
// resolver cannot address:
//
//   tx('landing.featuresTitle')  -> nested walk fails, flat tail 'title' hits
//                                         whichever unrelated chunk loaded last
//   tx('landing.featuresFlexible')-> no tail 'flexible' anywhere, so the raw
//                                         key string was rendered into the UI
//
// Both are silent failures, so this chunk is flat and every key is prefixed to
// stay unique against the other chunks (verified: no tail collisions).
//
// Content rule: only describe what Wasel really does. The product's four ways
// to move are rides, offered seats, parcels, and the scheduled bus backup
// (see config/user-navigation.ts). Services that have no page (motorcycle
// rentals, pet/medical/school transport, freight, luxury, gifts, rentals,
// shuttles) were removed from this chunk on purpose.
export const landing = {
  en: {
      heroTitle: 'Share the road. Split the cost.',
      heroSubtitle:
        'Rides, seats, parcels, and a bus backup on trusted routes across Jordan',
      heroGetStarted: 'Get Started',
      heroLearnMore: 'Learn More',
      heroWatchVideo: 'Watch Video',
      featuresTitle: 'Why choose Wasel?',
      featuresVerified: 'Trust checks, built in',
      featuresVerifiedDesc: 'Identity, email, phone, driver documents, and wallet standing are checked before you commit',
      featuresAffordable: 'Clear, fair prices',
      featuresAffordableDesc: 'See the route price before you book, with no surprises',
      featuresFlexible: 'Four ways to move',
      featuresFlexibleDesc: 'Rides, seats, parcels, and a scheduled bus in one app',
      featuresSupport: 'Help that follows your trip',
      featuresSupportDesc: 'Support stays attached to every ride, parcel, and payment',
      featuresSecure: 'Secure payments',
      featuresSecureDesc: 'Pay with your Wasel wallet or card, protected by encryption',
      featuresTracking: 'Live tracking',
      featuresTrackingDesc: 'Follow your ride or parcel in real time',
      servicesTitle: 'What you can do on Wasel',
      servicesSubtitle: 'Explore all services',
      servicesRidesharing: 'Find a ride',
      servicesRidesharingDesc: 'Book a seat on trusted routes across Jordan',
      servicesDelivery: 'Send a parcel',
      servicesDeliveryDesc: 'Ride-along delivery with pickup proof and tracking',
      servicesCarpool: 'Offer seats',
      servicesCarpoolDesc: 'Share your trip and offset the cost with trusted riders',
      servicesPublicBus: 'Scheduled bus',
      servicesPublicBusDesc: 'Compare scheduled departures when shared seats are thin',
      ctaTitle: 'Ready when you are',
      ctaSubtitle: 'Join Jordan\'s shared-mobility network',
      ctaDownloadApp: 'Download App',
      ctaSignUpNow: 'Create free account',
      statsUsers: 'Active Users',
      statsTrips: 'Trips Completed',
      statsCities: 'Cities covered',
      statsDrivers: 'Verified Drivers',
      statsServices: 'Ways to move',
      statsCorridors: 'Popular corridors',
      statsRoutes: 'Routes ready now',
  },
  ar: {
      heroTitle: 'شارك الطريق. وفّر مصاريك.',
      heroSubtitle: 'مشاوير، ومقاعد، وطرود، وباص احتياطي على مسارات موثوقة بكل الأردن',
      heroGetStarted: 'يلا نبدأ',
      heroLearnMore: 'اعرف أكثر',
      heroWatchVideo: 'شوف الفيديو',
      featuresTitle: 'ليش واصل؟',
      featuresVerified: 'فحوصات ثقة جاهزة',
      featuresVerifiedDesc: 'الهوية والإيميل والتلفون وأوراق السواق ووضع المحفظة بتنفحص قبل ما تلتزم',
      featuresAffordable: 'أسعار واضحة وعادلة',
      featuresAffordableDesc: 'بتشوف سعر المسار قبل ما تحجز، ولا مفاجآت',
      featuresFlexible: 'أربع طرق للتنقل',
      featuresFlexibleDesc: 'مشاوير ومقاعد وطرود وباص مجدول بتطبيق واحد',
      featuresSupport: 'دعم بيمشي مع مشوارك',
      featuresSupportDesc: 'الدعم مربوط بكل مشوار وطرد ودفعة',
      featuresSecure: 'دفع آمن',
      featuresSecureDesc: 'ادفع من محفظة واصل أو بالبطاقة، ومحمي بالتشفير',
      featuresTracking: 'تتبع مباشر',
      featuresTrackingDesc: 'تابع مشوارك أو طردك لحظة بلحظة',
      servicesTitle: 'شو بتعمل على واصل',
      servicesSubtitle: 'شوف كل الخدمات',
      servicesRidesharing: 'دوّر على مشوار',
      servicesRidesharingDesc: 'احجز مقعد على مسارات موثوقة بكل الأردن',
      servicesDelivery: 'ابعت طرد',
      servicesDeliveryDesc: 'توصيل مع مشوار ماشي، مع إثبات استلام وتتبع',
      servicesCarpool: 'اعرض مقاعدك',
      servicesCarpoolDesc: 'شارك مشوارك وخفّف التكلفة مع ركاب موثوقين',
      servicesPublicBus: 'باص مجدول',
      servicesPublicBusDesc: 'قارن مواعيد الباص لما تقل المقاعد المشتركة',
      ctaTitle: 'جاهز؟ يلا نبدأ',
      ctaSubtitle: 'انضم لشبكة التنقل المشترك بالأردن',
      ctaDownloadApp: 'نزّل التطبيق',
      ctaSignUpNow: 'افتح حساب مجاني',
      statsUsers: 'مستخدمين نشطين',
      statsTrips: 'مشاوير مكتملة',
      statsCities: 'مدن مغطاة',
      statsDrivers: 'سواقين موثوقين',
      statsServices: 'طرق للتنقل',
      statsCorridors: 'مسارات مشهورة',
      statsRoutes: 'مسارات جاهزة هسا',
  }
} as const;
