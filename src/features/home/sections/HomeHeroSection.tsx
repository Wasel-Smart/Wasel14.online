import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
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
import { API_URL } from '../../../services/core';

import { C, InlineCurrencySwitcher } from '../HomePageShared';

const MobilityOSLandingMap = lazy( () =>
  import( '../MobilityOSLandingMap' ).then( m => ( { default: m.MobilityOSLandingMap } ) ),
);
interface HomeHeroSectionProps {
  ar: boolean;
  user: User | null;
  firstName: string;
  onNavigate: ( path: string, source?: string ) => void;
  primaryTripPath: string;
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

interface LivePreviewData {
  priceJod: string;
  rating: string;
  parcelSlots: string;
  nextDeparture: string;
  utilization: number;
}

const STATIC_PREVIEW: LivePreviewData = {
  priceJod: '8.00 JOD',
  rating: '4.9',
  parcelSlots: '1',
  nextDeparture: '18:40',
  utilization: 0.78,
};

function useLiveRoutePreview(): LivePreviewData {
  const [data, setData] = useState<LivePreviewData>(STATIC_PREVIEW);

  useEffect(() => {
    if (!API_URL) return;
    const controller = new AbortController();
    fetch(`${API_URL}/mobility-os/public-snapshot`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((json: { corridors?: Array<{ priceJod?: number; demand?: number; seatsTotal?: number; seatsBooked?: number }> } | null) => {
        const first = json?.corridors?.[0];
        if (!first) return;
        const util = first.seatsTotal ? (first.seatsBooked ?? 0) / first.seatsTotal : 0.78;
        const slots = Math.max(0, (first.seatsTotal ?? 1) - (first.seatsBooked ?? 0));
        setData({
          priceJod: first.priceJod != null ? `${first.priceJod.toFixed(2)} JOD` : STATIC_PREVIEW.priceJod,
          rating: STATIC_PREVIEW.rating,
          parcelSlots: String(slots),
          nextDeparture: STATIC_PREVIEW.nextDeparture,
          utilization: util,
        });
      })
      .catch(() => { /* keep static fallback */ });
    return () => controller.abort();
  }, []);

  return data;
}

function ProductCommandPreview ( { ar }: { ar: boolean } ) {
  const { t } = useLanguage();
  const live = useLiveRoutePreview();

  const liveTimeline = [
    { labelKey: 'homeHeroSection.timeline_seat_price_label', value: live.priceJod, accent: C.cyan },
    { labelKey: 'homeHeroSection.timeline_driver_trust_label', value: ar ? `تقييم ${live.rating}` : `${live.rating} rating`, accent: C.green },
    { labelKey: 'homeHeroSection.timeline_parcel_option_label', value: ar ? `${live.parcelSlots} مكان` : `${live.parcelSlots} slot`, accent: C.gold },
    { labelKey: 'homeHeroSection.timeline_bus_fallback_label', value: live.nextDeparture, accent: C.blueLight },
  ];

  const timeline = liveTimeline;

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
            utilization={ live.utilization }
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
          { tx( 'homeHeroSection.hero_title' ) }
        </h1>

        <p className="wasel-home-lead">
          { firstName
            ? tx( 'homeHeroSection.hero_lead_user' ).replace( '{name}', firstName )
            : tx( 'homeHeroSection.hero_lead_guest' ) }
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
      </div>

      <div className="wasel-home-hero-aside">
        <ProductCommandPreview ar={ ar } />
      </div>
    </motion.section>
  );
}
