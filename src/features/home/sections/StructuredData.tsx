interface StructuredDataProps {
  ar: boolean;
}

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Wasel',
  alternateName: 'وصل',
  url: 'https://wasel14.online',
  logo: 'https://wasel14.online/brand/assets/logos/primary/logo-dark.png',
  // sameAs, telephone and foundingDate are intentionally omitted: they were
  // placeholder values (a 123-4567 phone number, unverified social profiles, an
  // invented founding date). Add them back only once they are real.
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'JO',
    addressLocality: 'Amman',
    addressRegion: 'Amman Governorate',
  },
  description: 'Wasel connects riders and drivers through shared routes to reduce travel cost across Jordan.',
};

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Wasel',
  alternateName: 'وصل',
  url: 'https://wasel14.online',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://wasel14.online/find-ride?from={from}&to={to}&search=1',
    },
    'query-input': 'required name=from, name=to',
  },
  inLanguage: ['en', 'ar'],
};

const SERVICE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Wasel Mobility Platform',
  alternateName: 'منصة واصل للتنقل',
  description: 'Intercity shared rides and package delivery across Jordan',
  provider: {
    '@type': 'Organization',
    name: 'Wasel',
    url: 'https://wasel14.online',
  },
  areaServed: {
    '@type': 'Country',
    name: 'Jordan',
  },
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceUrl: 'https://wasel14.online',
    availableLanguage: ['Arabic', 'English'],
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Wasel Services',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Intercity Ridesharing',
          description: 'Book seats on shared rides across Jordanian corridors',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Package Delivery',
          description: 'Send parcels with drivers already travelling your route',
        },
      },
    ],
  },
};

function createBreadcrumbSchema(ar: boolean) {
  const items = [
    { name: ar ? 'الرئيسية' : 'Home', url: 'https://wasel14.online' },
    { name: ar ? 'الخدمات' : 'Services', url: 'https://wasel14.online/app/services' },
    { name: ar ? 'البحث عن رحلة' : 'Find a Ride', url: 'https://wasel14.online/find-ride' },
    { name: ar ? 'عرض المقاعد' : 'Offer Seats', url: 'https://wasel14.online/offer-ride' },
    { name: ar ? 'إرسال طرد' : 'Send Package', url: 'https://wasel14.online/packages' },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function createFAQSchema(ar: boolean) {
  const faqs = [
    {
      q: ar ? 'كيف يعمل واصل؟' : 'How does Wasel work?',
      a: ar
        ? 'وصل يربط الركاب والسائقين عبر مسارات مشتركة لتقليل التكلفة. احجز رحلة، اعرض مقاعد، أو أرسل طرد.'
        : 'Wasel connects riders and drivers through shared routes to reduce cost. Book a ride, offer seats, or send a package.',
    },
    {
      q: ar ? 'ما هي المدن التي يغطيها واصل؟' : 'Which cities does Wasel cover?',
      a: ar
        ? 'وصل يغطي أهم مسارات التنقل بين المدن في الأردن بما فيها عمّان، العقبة، إربد، الزرقاء، البحر الميت، والبتراء.'
        : 'Wasel covers the main intercity corridors in Jordan including Amman, Aqaba, Irbid, Zarqa, Dead Sea, and Petra.',
    },
    {
      q: ar ? 'هل السائقين موثوقين؟' : 'Are drivers verified?',
      a: ar
        ? 'يمكن للسائقين إكمال التحقق من هويتهم، وتظهر شارة «موثق» للمتحقق منهم فقط. يمكنك مراجعة ملف السائق قبل الحجز.'
        : 'Drivers can verify their identity, and only verified drivers show a Verified badge. You can review a driver\'s profile before booking.',
    },
    {
      q: ar ? 'كيف أدفع؟' : 'How do I pay?',
      a: ar
        ? 'يدعم واصل المحفظة الرقمية. خيارات الدفع الأخرى قيد الإضافة.'
        : 'Wasel supports a digital wallet. Additional payment options are being added.',
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

export function StructuredData({ ar }: StructuredDataProps) {
  const schemas = [
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA,
    SERVICE_SCHEMA,
    createBreadcrumbSchema(ar),
    createFAQSchema(ar),
  ];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={`ld-json-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <meta name="description" content={ar
        ? 'وصل يربط الركاب والسائقين عبر مسارات مشتركة لتقليل التكلفة. احجز رحلة، اعرض مسارًا، أو انضم للشبكة في الأردن.'
        : 'Wasel connects riders and drivers through shared routes to reduce cost. Book a ride, offer a route, or join the network across Jordan.'}
      />
      <meta name="keywords" content={ar
        ? 'وصل، الأردن، تنقل، رحلات مشتركة، توصيل طرود، ركوب مشترك'
        : 'Wasel, Jordan, mobility, ridesharing, package delivery, carpool, intercity rides'}
      />
    </>
  );
}