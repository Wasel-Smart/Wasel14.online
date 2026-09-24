import fs from 'fs';

const file = 'supabase/migrations/20260223000000_production_schema.sql';
let content = fs.readFileSync( file, 'utf8' );

// Remove any broken DO $ block
content = content.replace( /DO\s+\$[\s\S]*?END\s+\$\s*;\s*/g, '' );
content = content.replace( /DO\s+\$\$[\s\S]*?END\s+\$\$\s*;\s*/g, '' );

const columnStatements = `
-- Add any missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_trips INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trips_as_driver INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trips_as_passenger INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_as_driver NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_as_passenger NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_ratings_received INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smoking_allowed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS music_allowed BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ar';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_license_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add any missing columns to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS from_lat NUMERIC(10,8);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS from_lng NUMERIC(11,8);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS to_lat NUMERIC(10,8);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS to_lng NUMERIC(11,8);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_km NUMERIC(8,2);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS route_polyline TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS departure_time TIME;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_departure TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 4;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS available_seats INTEGER DEFAULT 4;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS price_per_seat NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS smoking_allowed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS music_allowed BOOLEAN DEFAULT TRUE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS luggage_space TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_make TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_model TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_year INTEGER;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_color TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add any missing columns to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10,8);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(11,8);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC(10,8);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC(11,8);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_earnings NUMERIC(10,2);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passenger_rating INTEGER;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_rating INTEGER;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passenger_feedback TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_feedback TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
`;

content = content.replace( 'CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";', 'CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";\n' + columnStatements );
fs.writeFileSync( file, content, 'utf8' );
console.log( 'Successfully patched 20260223000000_production_schema.sql without DO block' );

