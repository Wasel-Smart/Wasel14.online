import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';
const files = fs.readdirSync( dir ).filter( f => f.endsWith( '.sql' ) );

for ( const file of files ) {
  const filePath = path.join( dir, file );
  let content = fs.readFileSync( filePath, 'utf8' );
  let original = content;

  // Prepend DROP CONSTRAINT IF EXISTS before ALTER TABLE ... ADD CONSTRAINT
  content = content.replace( /(?:ALTER\s+TABLE\s+([^\s]+)\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+([^\s;]+)\s*;\s*)?ALTER\s+TABLE\s+([^\s]+)\s+ADD\s+CONSTRAINT\s+([^\s]+)/gi, ( match, dropTab, dropCon, tab, con ) => {
    return `ALTER TABLE ${ tab } DROP CONSTRAINT IF EXISTS ${ con };\nALTER TABLE ${ tab } ADD CONSTRAINT ${ con }`;
  } );

  if ( file === '20260224000002_wasel_complete_schema.sql' ) {
    const tableReconcile = `
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trips') THEN
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_type TEXT DEFAULT 'ride';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS pickup_location GEOGRAPHY(POINT);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS pickup_address TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS dropoff_location GEOGRAPHY(POINT);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS dropoff_address TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_dropoff_location GEOGRAPHY(POINT);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS route_polyline TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS base_fare DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_fare DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS time_fare DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3, 2) DEFAULT 1.00;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS promo_code TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS total_fare DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_earnings DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rider_rating INTEGER;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_rating INTEGER;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rider_review TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_review TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS special_requirements JSONB DEFAULT '{}';
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS passenger_count INTEGER DEFAULT 1;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS luggage_count INTEGER DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'rider';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id);
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;
  END IF;
END $$;
`;
    if ( !content.includes( 'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rider_id' ) ) {
      const idx = content.indexOf( '-- ──' );
      if ( idx !== -1 ) {
        content = content.slice( 0, idx ) + tableReconcile + '\n' + content.slice( idx );
      }
    }
  }

  if ( content !== original ) {
    fs.writeFileSync( filePath, content, 'utf8' );
    console.log( 'Patched constraints/columns in: ' + file );
  }
}

