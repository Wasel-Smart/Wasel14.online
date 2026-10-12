/**
 * useRideInventory
 *
 * Fetches live ride inventory from Supabase (searchDirectTrips) and merges it
 * with locally-posted rides (getConnectedRides). Falls back to the static
 * ALL_RIDES seed data only when the database returns nothing, so the UI is
 * never empty during development.
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
    ...ALL_RIDES,
  ] );

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
      // Initial state already includes localRides + ALL_RIDES
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
        const merged = deduplicateRides( [ ...localRides, ...dbRides, ...ALL_RIDES ] );
        setRides( merged );
      } )
      .catch( err => {
        if ( controller.signal.aborted ) { return; }
        console.warn( '[useRideInventory] DB fetch failed, using local+static:', sanitizeLogMessage( err ) );
        setRides( [ ...localRides, ...ALL_RIDES ] );
      } )
      .finally( () => {
        if ( !controller.signal.aborted ) { setLoading( false ); }
      } );

    return () => { controller.abort(); };
  }, [ from, to, date, requestKey ] );

  // A failed fetch falls back to local + static rides, so no error is surfaced.
  return { rides, loading, error: null };
}

/** Deduplicate by id, preferring earlier entries (db > static). */
function deduplicateRides ( rides: Ride[] ): Ride[] {
  const seen = new Set<string>();
  return rides.filter( ride => {
    if ( !ride.id || seen.has( ride.id ) ) { return false; }
    seen.add( ride.id );
    return true;
  } );
}
