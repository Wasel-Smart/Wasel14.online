import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  CheckCircle,
  CircleDollarSign,
  Clock,
  MapPinned,
  PackageCheck,
  Route,
  Shield,
} from 'lucide-react';
import type { User } from '@supabase/auth-js';
import { WaselLogo } from '../../../components/wasel-ui';
import { WaselButton } from '../../../components/wasel-ui/WaselButton';
import { useLanguage } from '../../../contexts/LanguageContext';
import { tx } from '../../../locales/tx';

import { C, InlineCurrencySwitcher } from '../HomePageShared';

const MobilityOSLandingMap = lazy( () =>
  import( '../MobilityOSLandingMap' ).then( m => ( { default: m.MobilityOSLandingMap } ) ),
);
import type { TripMode } from './types';

interface HomeHeroSectionProps {
  ar: boolean;
  user: User | null;
  firstName: string;
  tripMode: TripMode;
  onTripModeChange: ( mode: TripMode ) => void;
  onNavigate: ( path: string, source?: string ) => void;
  primaryTripPath: string;
}

interface TripModeCardProps {
  tripMode: TripMode;
  onTripModeChange: ( mode: TripMode ) => void;
}

const heroProof = [
  {
    icon: BadgeCheck,
    labelKey: 'homeContent.proof_verified_label',
    detailKey: 'homeContent.proof_verified_detail',
    accent: C.green,
  },
  {
    icon: CircleDollarSign,
    labelKey: 'homeContent.proof_price_label',
    detailKey: 'homeContent.proof_price_detail',
    accent: C.gold,
  },
  {
    icon: Clock,
    labelKey: 'homeContent.proof_coordination_label',
    detailKey: 'homeContent.proof_coordination_detail',
    accent: C.cyan,
  },
] as const;

const liveTimeline = [
  { labelKey: 'homeHeroSection.timeline_seat_price_label', value: '8.00 JOD', accent: C.cyan },
  { labelKey: 'homeHeroSection.timeline_driver_trust_label', value: '4.9 rating', accent: C.green },
  { labelKey: 'homeHeroSection.timeline_parcel_option_label', value: '1 slot', accent: C.gold },
  { labelKey: 'homeHeroSection.timeline_bus_fallback_label', value: '18:40', accent: C.blueLight },
] as const;

const liveTimelineAr = [
  { labelKey: 'homeHeroSection.timeline_seat_price_label', value: '8.00 د.أ', accent: C.cyan },
  { labelKey: 'homeHeroSection.timeline_driver_trust_label', value: 'تقييم 4.9', accent: C.green },
  { labelKey: 'homeHeroSection.timeline_parcel_option_label', value: 'مكان واحد', accent: C.gold },
  { labelKey: 'homeHeroSection.timeline_bus_fallback_label', value: '18:40', accent: C.blueLight },
] as const;

function TripModeCard ( { tripMode, onTripModeChange }: TripModeCardProps ) {
  const { t } = useLanguage();
  const options = [
    {
      key: 'one-way' as TripMode,
      title: tx( 'homeHeroSection.trip_mode_one_way_title' ),
      desc: tx( 'homeHeroSection.trip_mode_one_way_desc' ),
    },
    {
      key: 'round' as TripMode,
      title: tx( 'homeHeroSection.trip_mode_round_title' ),
      desc: tx( 'homeHeroSection.trip_mode_round_desc' ),
    },
  ];

  return (
    <div className="wasel-home-start-panel">
      <div className="wasel-home-start-copy">
        <div className="wasel-home-kicker">{ tx( 'homeHeroSection.trip_type_kicker' ) }</div>
        <div className="wasel-home-start-text">
          { tx( 'homeHeroSection.trip_type_desc' ) }
        </div>
      </div>

      <div
        className="wasel-home-mode-grid"
        role="group"
        aria-label={ t( 'homeHeroSection.trip_mode' ) }
      >
        { options.map( option => {
          const selected = tripMode === option.key;
          return (
            <button
              type="button"
              aria-pressed={ selected }
              key={ option.key }
              onClick={ () => onTripModeChange( option.key ) }
              className="wasel-home-mode-button"
              style={ {
                background: selected ? C.cyanDim : 'transparent',
                borderColor: selected ? C.borderHov : 'rgba(20,127,228,0.12)',
                color: C.text,
              } }
            >
              <span>
                <strong>{ option.title }</strong>
                <small>{ option.desc }</small>
              </span>
              { selected ? <CheckCircle size={ 15 } color={ C.cyan } /> : null }
            </button>
          );
        } ) }
      </div>
    </div>
  );
}

function ProductCommandPreview ( { ar }: { ar: boolean } ) {
  const { t } = useLanguage();
  const timeline = ar ? liveTimelineAr : liveTimeline;

  return (
    <div
      className="wasel-home-preview-panel"
      aria-label={ t( 'homeHeroSection.wasel_product_preview' ) }
    >
      <div className="wasel-home-preview-top">
        <div>
          <div className="wasel-home-kicker">{ tx( 'homeHeroSection.route_preview_kicker' ) }</div>
          <div className="wasel-home-preview-title">
            { tx( 'homeHeroSection.route_preview_title' ) }
          </div>
        </div>
        <div className="wasel-home-live-chip">
          <span />
          { tx( 'homeHeroSection.live_chip_label' ) }
        </div>
      </div>

      <div className="wasel-home-map-frame">
        <Suspense fallback={ <div className="wasel-home-map-frame" style={ { minHeight: 330 } } /> }>
          <MobilityOSLandingMap
            focusRouteId="amman-aqaba"
            focusLabel={ ar ? 'عمان إلى العقبة' : 'Amman to Aqaba' }
            demandPressure={ 1.62 }
            utilization={ 0.78 }
            preferredHeight={ 330 }
            minimalText
            showOverlay={ false }
          />
        </Suspense>
      </div>

      <div className="wasel-home-product-stage">
        <div className="wasel-home-product-window">
          <div className="wasel-home-window-toolbar">
            <span />
            <span />
            <span />
            <strong>{ tx( 'homeHeroSection.window_best_option' ) }</strong>
          </div>
          <div className="wasel-home-window-route">
            <span>
              <MapPinned size={ 16 } color={ C.cyan } />
              { tx( 'homeHeroSection.window_origin' ) }
            </span>
            { ar ? <ArrowLeft size={ 14 } color={ C.textDim } /> : <ArrowRight size={ 14 } color={ C.textDim } /> }
            <span>{ tx( 'homeHeroSection.window_destination' ) }</span>
          </div>
          <div className="wasel-home-window-grid">
            { timeline.map( item => (
              <div key={ item.labelKey }>
                <small>{ tx( item.labelKey ) }</small>
                <strong style={ { color: item.accent } }>{ item.value }</strong>
              </div>
            ) ) }
          </div>
          <div className="wasel-home-window-progress">
            <span style={ { width: '78%' } } />
          </div>
        </div>

        <div className="wasel-home-phone-frame">
          <div className="wasel-home-phone-notch" />
          <div className="wasel-home-phone-screen">
            <div className="wasel-home-phone-status">
              <PackageCheck size={ 15 } color={ C.gold } />
              { tx( 'homeHeroSection.phone_parcel_matched' ) }
            </div>
            <strong>{ tx( 'homeHeroSection.phone_pickup_eta' ) }</strong>
            <p>{ tx( 'homeHeroSection.phone_linked_desc' ) }</p>
            <div className="wasel-home-phone-tags">
              <span>{ tx( 'homeHeroSection.phone_tag_wallet' ) }</span>
              <span>{ tx( 'homeHeroSection.phone_tag_proof' ) }</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LangToggle () {
  const { language, setLanguage } = useLanguage();
  const ar = language === 'ar';
  return (
    <button
      type="button"
      onClick={ () => setLanguage( ar ? 'en' : 'ar' ) }
      title={ tx( 'homeHeroSection.lang_toggle_title' ) }
      className="wasel-home-section-action"
      style={ { height: 34, padding: '0 12px', fontSize: '0.75rem' } }
    >
      { ar ? 'EN' : 'AR' }
    </button>
  );
}

export function HomeHeroSection ( {
  ar,
  user,
  firstName,
  tripMode,
  onTripModeChange,
  onNavigate,
  primaryTripPath,
}: HomeHeroSectionProps ) {
  const proofItems = heroProof;

  return (
    <motion.section className="wasel-home-hero" initial={ false }>
      <div className="wasel-home-hero-copy">
        <div className="wasel-home-nav">
          <div className="wasel-home-nav-left">
            <div className="wasel-home-brand-stack">
              <div className="wasel-home-eyebrow">
                <Shield size={ 13 } color={ C.cyan } />
                { tx( 'homeHeroSection.eyebrow_network' ) }
              </div>
              <WaselLogo size={ 80 } theme="light" variant="full" />
            </div>
          </div>
          <div className="wasel-home-nav-actions">
            <LangToggle />
            { user ? <InlineCurrencySwitcher ar={ ar } /> : null }
          </div>
        </div>

        <h1 className="wasel-home-title">
          { ar ? 'مسارات مشتركة تقلل تكلفة السفر' : 'Shared Routes That Reduce Travel Cost' }
        </h1>

        <p className="wasel-home-lead">
          { firstName
            ? (ar
                ? `أهلاً بعودتك، ${firstName}. واصل يربط الركاب والسائقين عبر مسارات مشتركة لتقليل التكلفة.`
                : `Welcome back, ${firstName}. Wasel connects riders and drivers through shared routes to reduce cost.`)
            : (ar
                ? 'واصل يربط الركاب والسائقين عبر مسارات مشتركة لتقليل التكلفة. احجز رحلة، اعرض مسارًا، أو انضم للشبكة في الأردن.'
                : 'Wasel connects riders and drivers through shared routes to reduce cost. Book a ride, offer a route, or join the network across Jordan.') }
        </p>

        <div className="wasel-home-proof-row">
          { proofItems.map( item => {
            const Icon = item.icon;
            return (
              <div key={ item.labelKey } className="wasel-home-proof-pill">
                <span className="wasel-home-proof-pill-icon" style={ { color: item.accent, background: `${ item.accent }14` } }>
                  <Icon size={ 16 } />
                </span>
                <div>
                  <strong style={ { color: C.text } }>{ tx( item.labelKey ) }</strong>
                  <small style={ { color: C.textMuted } }>{ tx( item.detailKey ) }</small>
                </div>
              </div>
            );
          } ) }
        </div>

        <div className="wasel-home-hero-actions">
          <WaselButton
            type="button"
            onClick={ () => onNavigate( primaryTripPath, 'hero_primary_route' ) }
            variant="primary"
            size="lg"
            icon={ <Route size={ 17 } /> }
            iconEnd={ ar ? <ArrowLeft size={ 16 } /> : <ArrowRight size={ 16 } /> }
          >
            { tx( 'homeHeroSection.cta_find_route' ) }
          </WaselButton>
          <WaselButton
            type="button"
            onClick={ () => onNavigate( '/offer-ride', 'hero_offer_seats' ) }
            variant="outline"
            size="lg"
            icon={ <CircleDollarSign size={ 17 } /> }
            style={ { background: C.elevated, color: C.text } }
          >
            { tx( 'homeHeroSection.cta_offer_seats' ) }
          </WaselButton>
        </div>

        <TripModeCard tripMode={ tripMode } onTripModeChange={ onTripModeChange } />
      </div>

      <div className="wasel-home-hero-aside">
        <ProductCommandPreview ar={ ar } />
      </div>
    </motion.section>
  );
}
