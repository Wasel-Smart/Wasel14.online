import { motion } from 'framer-motion';
import {
  BadgeCheck,
  CircleDollarSign,
  Clock,
  MapPinned,
  PackageCheck,
  Route,
  Shield,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { WaselButton } from '../../../components/wasel-ui/WaselButton';
import { C, POPULAR_ROUTES, R, SH, TYPE, F } from '../HomePageShared';
import { tx } from '../../../locales/tx';

interface LandingSectionsProps {
  ar: boolean;
  onNavigate: (path: string, source?: string) => void;
}
const featureCards = [
  {
    icon: Shield,
    titleKey: 'featuresVerified',
    descKey: 'featuresVerifiedDesc',
    accent: C.cyan,
  },
  {
    icon: CircleDollarSign,
    titleKey: 'featuresAffordable',
    descKey: 'featuresAffordableDesc',
    accent: C.gold,
  },
  {
    icon: Route,
    titleKey: 'featuresFlexible',
    descKey: 'featuresFlexibleDesc',
    accent: C.orange,
  },
  {
    icon: Users,
    titleKey: 'featuresSupport',
    descKey: 'featuresSupportDesc',
    accent: C.green,
  },
  {
    icon: BadgeCheck,
    titleKey: 'featuresSecure',
    descKey: 'featuresSecureDesc',
    accent: C.blue,
  },
  {
    icon: Clock,
    titleKey: 'featuresTracking',
    descKey: 'featuresTrackingDesc',
    accent: C.purple,
  },
] as const;

// Every card must land on a route the router actually declares — a path with no
// route behind it lands the visitor on the 404 page, which is a dead end from
// the marketing surface. These four services are delivered through existing
// Wasel capabilities rather than a dedicated page:
//   Freight  -> parcel/cargo capacity on the packages surface
//   Commute  -> posting your own seats is carpooling (offer-ride)
//   School   -> scheduled, route-fixed transport (bus)
//   Luxury   -> the premium tier (plus)
const serviceCards = [
  {
    icon: Route,
    titleKey: 'servicesRidesharing',
    descKey: 'servicesRidesharingDesc',
    accent: C.cyan,
    path: '/find-ride',
  },
  {
    icon: PackageCheck,
    titleKey: 'servicesDelivery',
    descKey: 'servicesDeliveryDesc',
    accent: C.orange,
    path: '/packages',
  },
  {
    icon: Truck,
    titleKey: 'servicesFreight',
    descKey: 'servicesFreightDesc',
    accent: C.blue,
    path: '/packages',
  },
  {
    icon: MapPinned,
    titleKey: 'servicesCarpool',
    descKey: 'servicesCarpoolDesc',
    accent: C.green,
    path: '/offer-ride',
  },
  {
    icon: Shield,
    titleKey: 'servicesSchool',
    descKey: 'servicesSchoolDesc',
    accent: C.gold,
    path: '/bus',
  },
  {
    icon: Star,
    titleKey: 'servicesLuxury',
    descKey: 'servicesLuxuryDesc',
    accent: C.purple,
    path: '/plus',
  },
] as const;

// Counts are derived from data the app already ships, never invented. The
// service count matches landing.featuresFlexibleDesc ("12 specialized
// services"), and the corridor/city counts are computed from POPULAR_ROUTES.
// A previous revision hardcoded "50K+ / 200K+ / 5K+" user and trip totals
// that exist in no source and on no live surface — fabricated traction
// figures on a public marketing page, so they are gone.
const SERVICE_COUNT = 12;
const CORRIDOR_COUNT = POPULAR_ROUTES.length;
const CITY_COUNT = new Set(POPULAR_ROUTES.map(r => r.to)).size;

const stats = [
  { value: String(SERVICE_COUNT), labelKey: 'statsServices', accent: C.cyan },
  { value: String(CORRIDOR_COUNT), labelKey: 'statsCorridors', accent: C.gold },
  { value: String(CITY_COUNT), labelKey: 'statsCities', accent: C.orange },
  { value: String(CORRIDOR_COUNT), labelKey: 'statsRoutes', accent: C.green },
] as const;

export function LandingSections({ ar, onNavigate }: LandingSectionsProps) {
  return (
    <>
      <motion.section
        initial={false}
        className="wasel-home-section"
        aria-labelledby="features-heading"
      >
        <div className="wasel-home-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="wasel-home-section-icon" style={{ color: C.cyan }}>
              <Shield size={16} />
            </div>
            <h2 id="features-heading" className="wasel-home-section-title">
              {tx('featuresTitle')}
            </h2>
          </div>
        </div>
        <div
          className="wasel-home-features-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.titleKey}
                initial={false}
                whileHover={{ y: -4 }}
                style={{
                  borderRadius: R.xl,
                  padding: '24px',
                  background: C.card,
                  border: `1px solid ${feature.accent}24`,
                  boxShadow: SH.sm,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: R.lg,
                    background: `${feature.accent}14`,
                    border: `1px solid ${feature.accent}24`,
                    color: feature.accent,
                  }}
                >
                  <Icon size={22} />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    fontWeight: TYPE.weight.black,
                    color: C.text,
                    lineHeight: 1.3,
                  }}
                >
                  {tx(feature.titleKey)}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: C.textMuted,
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                  }}
                >
                  {tx(feature.descKey)}
                </p>
              </motion.article>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={false}
        className="wasel-home-section"
        aria-labelledby="services-heading"
      >
        <div className="wasel-home-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="wasel-home-section-icon" style={{ color: C.gold }}>
              <Route size={16} />
            </div>
            <h2 id="services-heading" className="wasel-home-section-title">
              {tx('servicesTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="wasel-home-section-action"
            onClick={() => void onNavigate('/app', 'services_browse_all')}
          >
            {tx('servicesSubtitle')}
          </button>
        </div>
        <div
          className="wasel-home-services-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {serviceCards.map((service) => {
            const Icon = service.icon;
            return (
              <motion.button
                key={service.titleKey}
                type="button"
                initial={false}
                whileHover={{ y: -2 }}
                onClick={() => void onNavigate(service.path, `service_${service.path.replace('/', '')}`)}
                style={{
                  textAlign: 'left',
                  borderRadius: R.xl,
                  padding: '20px',
                  background: C.card,
                  border: `1px solid ${service.accent}24`,
                  boxShadow: SH.sm,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: R.lg,
                    background: `${service.accent}14`,
                    border: `1px solid ${service.accent}24`,
                    color: service.accent,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.02rem',
                      fontWeight: TYPE.weight.black,
                      color: C.text,
                      lineHeight: 1.35,
                    }}
                  >
                    {tx(service.titleKey)}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: C.textMuted,
                      fontSize: '0.84rem',
                      lineHeight: 1.55,
                    }}
                  >
                    {tx(service.descKey)}
                  </p>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: service.accent,
                    fontWeight: TYPE.weight.bold,
                    fontSize: '0.8rem',
                  }}
                >
                  {tx('homeSections.quickActionsCTA')}
                  {ar ? <Route size={12} style={{ transform: 'rotate(180deg)' }} /> : <Route size={12} />}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={false}
        className="wasel-home-section"
        aria-labelledby="stats-heading"
      >
        <div
          style={{
            borderRadius: R.xxl,
            padding: '32px 24px',
            background: `linear-gradient(180deg, ${C.cyanDim}, ${C.card})`,
            border: `1px solid ${C.cyanDim}`,
            boxShadow: SH.lg,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: C.cyan,
                marginBottom: 8,
              }}
            >
              {tx('homeSections.statsTitle')}
            </div>
            <h2 id="stats-heading" className="wasel-home-section-title" style={{ margin: 0, textAlign: 'center' }}>
              {tx('ctaTitle')}
            </h2>
          </div>
          <div
            className="wasel-home-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.labelKey}
                style={{
                  textAlign: 'center',
                  padding: '0 12px',
                  borderRight: index < stats.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: TYPE.weight.ultra,
                    color: stat.accent,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    fontFamily: F,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: '0.85rem',
                    color: C.textMuted,
                    fontWeight: TYPE.weight.medium,
                  }}
                >
                  {tx(stat.labelKey)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <WaselButton
              type="button"
              variant="primary"
              size="lg"
              icon={<Route size={17} />}
              iconEnd={ar ? <Route size={16} style={{ transform: 'rotate(180deg)' }} /> : <Route size={16} />}
              onClick={() => void onNavigate('/app/auth?tab=register', 'stats_cta_register')}
            >
              {tx('ctaSignUpNow')}
            </WaselButton>
          </div>
        </div>
      </motion.section>
    </>
  );
}