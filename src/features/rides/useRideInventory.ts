/**
 * useRideInventory
 *
 * Fetches live ride inventory from Supabase (searchDirectTrips) and merges it
 * with locally-posted rides (getConnectedRides).
 *
 * The static ALL_RIDES seed (invented drivers, fake verified badges) is demo
 * data and is ONLY included in local development / E2E runs. It must never
 * reach production users, so it is empty in every production build.
 */
import { useEffect, useState } from 'react';
import { searchDirectTrips } from '../../services/directSupabase/trips';
import { getConnectedRides } from '../../services/journeyLogistics';
import {
  buildRideFromPostedRide,
  buildRideFromTripSearchResult,
  ALL_RIDES,
  type Ride,
} from '../../pages/waselCoreRideData';
import { sanitizeLogMessage } from '../../utils/sanitization';

const DEMO_RIDES_ENABLED =
  Boolean( import.meta.env.DEV ) &&
  ( import.meta.env.VITE_ENABLE_DEMO_RIDES === 'true' || import.meta.env.VITE_E2E_LOCAL_AUTH === 'true' );

const SEED_RIDES: Ride[] = DEMO_RIDES_ENABLED ? ALL_RIDES : [];

interface UseRideInventoryOptions {
  from: string;
  to: string;
  date: string;
  searched: boolean;
}

interface UseRideInventoryResult {
  rides: Ride[];
  loading: boolean;
  error: string | null;
}

export function useRideInventory ( {
  from,
  to,
  date,
  searched,
}: UseRideInventoryOptions ): UseRideInventoryResult {
  const [ rides, setRides ] = useState<Ride[]>( () => [
    ...getConnectedRides().map( buildRideFromPostedRide ),
    ...SEED_RIDES,
  ] );
  const [ error, setError ] = useState<string | null>( null );

  // A search is identified by its inputs; `null` means no search is requested.
  const requestKey = searched ? JSON.stringify( [ from, to, date ] ) : null;
  const [ loading, setLoading ] = useState( requestKey !== null );
  const [ trackedRequestKey, setTrackedRequestKey ] = useState<string | null>( requestKey );

  // Loading starts the moment a new search is requested. It is adjusted during
  // render, guarded by the key comparison, rather than by calling setState
  // synchronously inside the effect (react-hooks/set-state-in-effect). React
  // re-renders immediately, before the effect below runs, so the UI never
  // shows a stale "not loading" frame for a new request.
  if ( trackedRequestKey !== requestKey ) {
    setTrackedRequestKey( requestKey );
    setLoading( requestKey !== null );
  }

  useEffect( () => {
    if ( requestKey === null ) {
      // Initial state already includes local rides (+ demo seed in dev only)
      return;
    }

    const localRides = getConnectedRides().map( buildRideFromPostedRide );
    // Cleanup aborts the previous request before the next effect run, so a stale
    // response can never overwrite a newer one.
    const controller = new AbortController();

    searchDirectTrips( from || undefined, to || undefined, date || undefined )
      .then( results => {
        if ( controller.signal.aborted ) { return; }
        const dbRides = results.map( buildRideFromTripSearchResult );
        const merged = deduplicateRides( [ ...localRides, ...dbRides, ...SEED_RIDES ] );
        setError( null );
        setRides( merged );
      } )
      .catch( err => {
        if ( controller.signal.aborted ) { return; }
        console.warn( '[useRideInventory] DB fetch failed:', sanitizeLogMessage( err ) );
        setError( 'Could not load rides right now. Please try again.' );
        setRides( [ ...localRides, ...SEED_RIDES ] );
      } )
      .finally( () => {
        if ( !controller.signal.aborted ) { setLoading( false ); }
      } );

    return () => { controller.abort(); };
  }, [ from, to, date, requestKey ] );

  return { rides, loading, error };
}

/** Deduplicate by id, preferring earlier entries (local > db > demo seed). */
function deduplicateRides ( rides: Ride[] ): Ride[] {
  const seen = new Set<string>();
  return rides.filter( ride => {
    if ( !ride.id || seen.has( ride.id ) ) { return false; }
    seen.add( ride.id );
    return true;
  } );
}
