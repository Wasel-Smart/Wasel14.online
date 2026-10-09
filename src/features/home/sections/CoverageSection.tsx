import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, MapPinned, Route } from 'lucide-react';
import { WaselButton } from '../../../components/wasel-ui/WaselButton';
import { C, POPULAR_ROUTES } from '../HomePageShared';
import { tx } from '../../../locales/tx';

interface CoverageSectionProps {
  ar: boolean;
  onNavigate: ( path: string, source?: string ) => void;
}

interface Region {
  nameKey: string;
  statusKey: string;
  live?: boolean;
}

const REGIONS: Region[] = [
  { nameKey: 'homeSections.coverageJordanLive', statusKey: 'homeSections.coverageJordanStatus', live: true },
  { nameKey: 'homeSections.coverageLevant', statusKey: 'homeSections.coverageLevantStatus' },
  { nameKey: 'homeSections.coverageGCC', statusKey: 'homeSections.coverageGCCStatus' },
  { nameKey: 'homeSections.coverageNorthAfrica', statusKey: 'homeSections.coverageNorthAfricaStatus' },
  { nameKey: 'homeSections.coverageEastAfrica', statusKey: 'homeSections.coverageEastAfricaStatus' },
];

// Destination marquee: every city Wasel's corridors already reach,
// derived from the route table so copy and data never drift apart.
function buildDestinations( ar: boolean ): string[] {
  const names = new Set<string>( [
    ar ? POPULAR_ROUTES[ 0 ].fromAr : POPULAR_ROUTES[ 0 ].from,
  ] );
  for ( const route of POPULAR_ROUTES ) {
    names.add( ar ? route.toAr : route.to );
  }
  return Array.from( names );
}

export function CoverageSection( { ar, onNavigate }: CoverageSectionProps ) {
  const reduceMotion = useReducedMotion();
  const destinations = buildDestinations( ar );
  const loop = [ ...destinations, ...destinations ];

  return (
    <motion.section
      className="wasel-home-section"
      initial={ reduceMotion ? false : { opacity: 0, y: 24 } }
      whileInView={ reduceMotion ? undefined : { opacity: 1, y: 0 } }
      viewport={ { once: true, margin: '-60px' } }
      transition={ { duration: 0.28, ease: [ 0.4, 0, 0.2, 1 ] } }
      aria-labelledby="coverage-title"
    >
      <div className="wasel-coverage">
        <div className="wasel-coverage-kicker">
          <MapPinned size={ 14 } aria-hidden="true" />
          { tx( 'homeSections.coverageKicker' ) }
        </div>

        <h2 id="coverage-title" className="wasel-coverage-title">
          { tx( 'homeSections.coverageTitle' ) }
        </h2>

        <p className="wasel-coverage-subtitle">
          { tx( 'homeSections.coverageSubtitle' ) }
        </p>

        <div className="wasel-coverage-regions">
          { REGIONS.map( region => (
            <div
              key={ region.nameKey }
              className={ `wasel-coverage-region${ region.live ? ' is-live' : '' }` }
            >
              <span className="wasel-coverage-region-dot" aria-hidden="true" />
              <div>
                <div className="wasel-coverage-region-name">{ tx( region.nameKey ) }</div>
                <div className="wasel-coverage-region-status">{ tx( region.statusKey ) }</div>
              </div>
            </div>
          ) ) }
        </div>

        <div className="wasel-coverage-note">
          <Check size={ 15 } color={ C.green } aria-hidden="true" />
          { tx( 'homeSections.coverageNote' ) }
        </div>

        <div className="wasel-dest-marquee" aria-hidden="true">
          <div className="wasel-dest-track">
            { loop.map( ( name, index ) => (
              <span key={ `${ name }-${ index }` } className="wasel-dest-item">
                <MapPinned size={ 15 } />
                { name }
              </span>
            ) ) }
          </div>
        </div>

        <div style={ { marginTop: 30, display: 'flex', justifyContent: 'flex-start' } }>
          <WaselButton
            type="button"
            variant="primary"
            size="lg"
            icon={ <Route size={ 17 } /> }
            iconEnd={ ar ? <ArrowLeft size={ 16 } /> : <ArrowRight size={ 16 } /> }
            onClick={ () => { void onNavigate( '/find-ride', 'coverage_live_corridors' ); } }
          >
            { tx( 'homeSections.coverageCta' ) }
          </WaselButton>
        </div>
      </div>
    </motion.section>
  );
}
