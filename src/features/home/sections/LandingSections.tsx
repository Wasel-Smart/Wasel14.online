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
import { C, R, SH, TYPE, F } from '../HomePageShared';
import { tx } from '../../../locales/tx';

interface LandingSectionsProps {
  ar: boolean;
  onNavigate: (path: string, source?: string) => void;
}

const featureCards = [
  {
    icon: Shield,
    titleKey: 'landing.features.verified',
    descKey: 'landing.features.verifiedDesc',
    accent: C.cyan,
  },
  {
    icon: CircleDollarSign,
    titleKey: 'landing.features.affordable',
    descKey: 'landing.features.affordableDesc',
    accent: C.gold,
  },
  {
    icon: Route,
    titleKey: 'landing.features.flexible',
    descKey: 'landing.features.flexibleDesc',
    accent: C.orange,
  },
  {
    icon: Users,
    titleKey: 'landing.features.support',
    descKey: 'landing.features.supportDesc',
    accent: C.green,
  },
  {
    icon: BadgeCheck,
    titleKey: 'landing.features.secure',
    descKey: 'landing.features.secureDesc',
    accent: C.blue,
  },
  {
    icon: Clock,
    titleKey: 'landing.features.tracking',
    descKey: 'landing.features.trackingDesc',
    accent: C.purple,
  },
] as const;

const serviceCards = [
  {
    icon: Route,
    titleKey: 'landing.services.ridesharing',
    descKey: 'landing.services.ridesharingDesc',
    accent: C.cyan,
    path: '/find-ride',
  },
  {
    icon: PackageCheck,
    titleKey: 'landing.services.delivery',
    descKey: 'landing.services.deliveryDesc',
    accent: C.orange,
    path: '/packages',
  },
  {
    icon: Truck,
    titleKey: 'landing.services.freight',
    descKey: 'landing.services.freightDesc',
    accent: C.blue,
    path: '/freight',
  },
  {
    icon: MapPinned,
    titleKey: 'landing.services.carpool',
    descKey: 'landing.services.carpoolDesc',
    accent: C.green,
    path: '/carpool',
  },
  {
    icon: Shield,
    titleKey: 'landing.services.school',
    descKey: 'landing.services.schoolDesc',
    accent: C.gold,
    path: '/school',
  },
  {
    icon: Star,
    titleKey: 'landing.services.luxury',
    descKey: 'landing.services.luxuryDesc',
    accent: C.purple,
    path: '/luxury',
  },
] as const;

const stats = [
  { value: '50K+', labelKey: 'landing.stats.users', accent: C.cyan },
  { value: '200K+', labelKey: 'landing.stats.trips', accent: C.gold },
  { value: '12', labelKey: 'landing.stats.cities', accent: C.orange },
  { value: '5K+', labelKey: 'landing.stats.drivers', accent: C.green },
] as const;

export function LandingSections({ ar, onNavigate }: LandingSectionsProps) {
  const reduceMotion = ar; // placeholder, will be replaced with useReducedMotion

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
              {tx('landing.features.title')}
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
          {featureCards.map((feature, index) => {
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
              {tx('landing.services.title')}
            </h2>
          </div>
          <button
            type="button"
            className="wasel-home-section-action"
            onClick={() => void onNavigate('/app/services', 'services_browse_all')}
          >
            {tx('landing.services.subtitle')}
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
              {tx('landing.statsTitle') || 'Platform at a glance'}
            </div>
            <h2 id="stats-heading" className="wasel-home-section-title" style={{ margin: 0, textAlign: 'center' }}>
              {tx('landing.cta.title') || 'Ready to get started?'}
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
              {tx('landing.cta.signUpNow') || 'Sign Up Now'}
            </WaselButton>
          </div>
        </div>
      </motion.section>
    </>
  );
}