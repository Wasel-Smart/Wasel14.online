import fs from 'fs';

const file = 'supabase/migrations/20260224000000_production_backend_schema.sql';
let content = fs.readFileSync( file, 'utf8' );

// Clean out any broken DO blocks
content = content.replace( /-- Reconcile columns[\s\S]*?-- TABLES/g, '-- TABLES' );
content = content.replace( /DO\s+\$[\s\S]*?END\s+\$\s*;\s*/g, '' );

const tableReconcile = `
-- Reconcile columns for existing tables
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trips') THEN
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin_lat DECIMAL(10,8);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin_lng DECIMAL(11,8);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination TEXT;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination_lat DECIMAL(10,8);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination_lng DECIMAL(11,8);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10,2);
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS booked_seats INTEGER DEFAULT 0;
    ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS luggage_allowed BOOLEAN DEFAULT TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS seats_booked INTEGER DEFAULT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
    ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS rater_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS rated_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS comment TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS air_conditioning BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS bluetooth BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
  END IF;
END $$;
`;

const idx = content.indexOf( '-- TABLES' );
if ( idx !== -1 ) {
  content = content.slice( 0, idx ) + tableReconcile + '\n' + content.slice( idx );
}

fs.writeFileSync( file, content, 'utf8' );
console.log( 'Fixed DO $$ block in 20260224000000_production_backend_schema.sql' );

