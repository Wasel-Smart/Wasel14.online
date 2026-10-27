/**
 * Hero route preview data.
 *
 * Two modes, never mixed:
 *  - Sample: clearly-labelled illustrative figures (STATIC_PREVIEW).
 *  - Live:   only values that the public snapshot really carries for the
 *            Amman -> Aqaba corridor the preview is drawn for. Anything the
 *            snapshot does not carry (driver rating, departure time, parcel
 *            capacity) is left empty so the UI omits it instead of falling
 *            back to a sample figure under a "LIVE" label.
 */

export interface LivePreviewData {
  priceJod: string;
  rating: string;
  parcelSlots: string;
  nextDeparture: string;
  utilization: number;
  demandPressure: number;
}

export const STATIC_PREVIEW: LivePreviewData = {
  priceJod: '8.00 JOD',
  rating: '4.9',
  parcelSlots: '1',
  nextDeparture: '18:40',
  utilization: 0.78,
  demandPressure: 1,
};

export interface SnapshotCorridor {
  id?: string;
  from?: string;
  to?: string;
  priceJod?: number;
  demand?: number;
  seatsTotal?: number;
  seatsBooked?: number;
}

export interface PublicSnapshot {
  corridors?: SnapshotCorridor[];
}

const norm = ( value?: string ) => ( value ?? '' ).trim().toLowerCase();

function isAmmanAqaba( corridor: SnapshotCorridor ): boolean {
  if ( corridor.id === 'amman-aqaba' ) { return true; }
  const from = norm( corridor.from );
  const to = norm( corridor.to );
  return ( from === 'amman' && to === 'aqaba' ) || ( from === 'aqaba' && to === 'amman' );
}

/**
 * Returns live preview data, or null when the snapshot has no usable
 * Amman -> Aqaba corridor with a real price (caller keeps the sample + label).
 */
export function buildLivePreview( snapshot: PublicSnapshot | null | undefined ): LivePreviewData | null {
  const corridor = snapshot?.corridors?.find( isAmmanAqaba );
  if ( !corridor ) { return null; }
  if ( typeof corridor.priceJod !== 'number' || !Number.isFinite( corridor.priceJod ) ) { return null; }

  const total = typeof corridor.seatsTotal === 'number' ? corridor.seatsTotal : 0;
  const booked = typeof corridor.seatsBooked === 'number' ? corridor.seatsBooked : 0;
  const utilization = total > 0 ? Math.min( 1, Math.max( 0, booked / total ) ) : 0;
  const demandPressure =
    typeof corridor.demand === 'number' && Number.isFinite( corridor.demand ) ? corridor.demand : 1;

  return {
    priceJod: `${ corridor.priceJod.toFixed( 2 ) } JOD`,
    rating: '',
    parcelSlots: '',
    nextDeparture: '',
    utilization,
    demandPressure,
  };
}
