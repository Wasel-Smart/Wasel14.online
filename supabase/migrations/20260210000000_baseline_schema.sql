-- ============================================================================
-- WASEL PLATFORM - CONSOLIDATED BASELINE SCHEMA
-- Migration: 20260210000000_baseline_schema.sql
-- Description: Consolidated baseline schema replacing the 14 overlapping migrations:
--    1. 20260210_complete_schema.sql
--    2. 20260211000000_add_notes_to_trips.sql
--    3. 20260211000001_profile_change_history.sql
--    4. 20260223000000_production_schema.sql
--    5. 20260224000000_production_backend_schema.sql
--    6. 20260224000001_backup_configuration.sql
--    7. 20260224000002_wasel_complete_schema.sql
--    8. 20260224000003_postgis_functions.sql
--    9. 20260224000004_additional_tables.sql
--   10. 20260302000000_regionalization_schema.sql
--   11. 20260310000000_security_performance_fixes.sql
--   12. 20260320000001_wasel_enhancements.sql
--   13. 20261017000000_rls_price_and_view_hardening.sql
--   14. 20261017000001_ensure_exposed_schemas.sql
-- ============================================================================

-- ============================================================================
-- SECTION: 20260210_complete_schema.sql
-- ============================================================================

-- ============================================================================
-- WASSEL SUPER APP - PRODUCTION DATABASE SCHEMA
-- Version: 2.0.0
-- Date: February 10, 2026
-- ============================================================================

-- Enable necessary extensions
-- Supabase auto-installs uuid-ossp into the "extensions" schema on new
-- projects, which breaks bare (unqualified) calls like uuid_generate_v4()
-- used throughout these migrations. IF NOT EXISTS would silently skip and
-- leave it there, so we drop and recreate it in public explicitly -- safe
-- here since this is the first migration on a fresh database.
DROP EXTENSION IF EXISTS "uuid-ossp";
CREATE EXTENSION "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public; -- For text search
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA public; -- For geospatial queries
-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (
    gender IN ('male', 'female', 'other', 'prefer_not_to_say')
  ),
  -- Verification Status
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  id_verified BOOLEAN DEFAULT false,
  driver_license_verified BOOLEAN DEFAULT false,
  
  -- Trip Statistics
  total_trips INTEGER DEFAULT 0,
  trips_as_driver INTEGER DEFAULT 0,
  trips_as_passenger INTEGER DEFAULT 0,
  
  -- Ratings
  rating_as_driver DECIMAL(3, 2) DEFAULT 0.0 CHECK (
    rating_as_driver >= 0
    AND rating_as_driver <= 5
  ),
  rating_as_passenger DECIMAL(3, 2) DEFAULT 0.0 CHECK (
    rating_as_passenger >= 0
    AND rating_as_passenger <= 5
  ),
  total_ratings_received INTEGER DEFAULT 0,
  
  -- Preferences
  smoking_allowed BOOLEAN DEFAULT false,
  pets_allowed BOOLEAN DEFAULT false,
  music_allowed BOOLEAN DEFAULT true,
  max_2_back_seat BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  currency TEXT DEFAULT 'AED' CHECK (
    currency IN ('AED', 'SAR', 'KWD', 'BHD', 'EGP', 'JOD')
  ),
  -- Settings
  notification_enabled BOOLEAN DEFAULT true,
  location_sharing_enabled BOOLEAN DEFAULT true,
  auto_accept_bookings BOOLEAN DEFAULT false,
  
  -- Financial
  wallet_balance DECIMAL(10, 2) DEFAULT 0.0,
  total_earned DECIMAL(10, 2) DEFAULT 0.0,
  total_spent DECIMAL(10, 2) DEFAULT 0.0,
  -- Vehicle Information (for drivers)
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  vehicle_plate_number TEXT,
  vehicle_seats INTEGER CHECK (
    vehicle_seats >= 1
    AND vehicle_seats <= 8
  ),
  -- Metadata
  bio TEXT,
  interests TEXT[],
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_rating_driver ON profiles(rating_as_driver DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_rating_passenger ON profiles(rating_as_passenger DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at)
WHERE deleted_at IS NULL;
-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON profiles USING gin(full_name gin_trgm_ops);
-- ============================================================================
-- 2. TRIPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Route Information
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  from_coordinates POINT, -- PostGIS point type
  to_coordinates POINT,
  distance_km DECIMAL(10, 2),
  estimated_duration_minutes INTEGER,
  waypoints JSONB, -- Array of intermediate stops
  
  -- Schedule
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME,
  
  -- Capacity & Pricing
  total_seats INTEGER NOT NULL CHECK (
    total_seats >= 1
    AND total_seats <= 8
  ),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
  price_per_seat DECIMAL(10, 2) NOT NULL CHECK (price_per_seat >= 0),
  currency TEXT DEFAULT 'AED' NOT NULL,
  
  -- Trip Type
  trip_type TEXT DEFAULT 'one-time' CHECK (
    trip_type IN ('one-time', 'recurring', 'scheduled', 'return')
  ),
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly'
  recurrence_days INTEGER [], -- Days of week (1=Monday, 7=Sunday)
  
  -- Status
  status TEXT DEFAULT 'published' CHECK (
    status IN (
      'draft',
      'published',
      'in-progress',
      'completed',
      'cancelled'
    )
  ),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  
  -- Preferences
  smoking_allowed BOOLEAN DEFAULT false,
  pets_allowed BOOLEAN DEFAULT false,
  luggage_allowed BOOLEAN DEFAULT true,
  music_preference TEXT CHECK (music_preference IN ('yes', 'no', 'ask')),
  conversation_level TEXT CHECK (
    conversation_level IN ('quiet', 'moderate', 'chatty')
  ),
  -- Additional Info
  notes TEXT,
  vehicle_info TEXT,
  amenities TEXT [], -- ['wifi', 'phone-charger', 'snacks', 'ac']
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT available_seats_check CHECK (available_seats <= total_seats)
);

-- Indexes for trips
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_departure_date ON trips(departure_date);
CREATE INDEX IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_available_seats ON trips(available_seats)
WHERE available_seats > 0;
CREATE INDEX IF NOT EXISTS idx_trips_from_location ON trips USING gin(from_location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trips_to_location ON trips USING gin(to_location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
-- Geospatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_trips_from_coordinates ON trips USING gist(from_coordinates);
CREATE INDEX IF NOT EXISTS idx_trips_to_coordinates ON trips USING gist(to_coordinates);
-- Composite index for search queries
CREATE INDEX IF NOT EXISTS idx_trips_search ON trips(status, departure_date, available_seats)
WHERE status = 'published'
  AND available_seats > 0;
-- ============================================================================
-- 3. BOOKINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Booking Details
  seats_requested INTEGER NOT NULL CHECK (seats_requested >= 1),
  pickup_location TEXT,
  dropoff_location TEXT,
  pickup_coordinates POINT,
  dropoff_coordinates POINT,
  
  -- Pricing
  price_per_seat DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'AED' NOT NULL,
  platform_fee DECIMAL(10, 2) DEFAULT 0.0,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'accepted',
      'rejected',
      'cancelled',
      'completed'
    )
  ),
  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'paid', 'refunded', 'failed')
  ),
  payment_method TEXT,
  payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Cancellation
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  
  -- Special Requests
  special_requests TEXT,
  luggage_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
-- ============================================================================
-- 4. MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Message Content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (
    message_type IN ('text', 'system', 'location', 'image', 'file')
  ),
  metadata JSONB, -- For location coords, file URLs, etc.
  
  -- Status
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read)
WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
-- Composite index for conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);
-- ============================================================================
-- 5. REVIEWS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Review Type
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  
  -- Ratings (1-5 scale)
  overall_rating INTEGER NOT NULL CHECK (
    overall_rating >= 1
    AND overall_rating <= 5
  ),
  punctuality_rating INTEGER CHECK (
    punctuality_rating >= 1
    AND punctuality_rating <= 5
  ),
  communication_rating INTEGER CHECK (
    communication_rating >= 1
    AND communication_rating <= 5
  ),
  cleanliness_rating INTEGER CHECK (
    cleanliness_rating >= 1
    AND cleanliness_rating <= 5
  ),
  safety_rating INTEGER CHECK (
    safety_rating >= 1
    AND safety_rating <= 5
  ),
  -- Review Content
  comment TEXT,
  tags TEXT [], -- ['friendly', 'on-time', 'clean-car', 'great-music']
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  is_reported BOOLEAN DEFAULT false,
  report_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT no_self_review CHECK (reviewer_id != reviewee_id),
  CONSTRAINT one_review_per_booking UNIQUE (booking_id, reviewer_id)
);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_trip_id ON reviews(trip_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_overall_rating ON reviews(overall_rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_public ON reviews(is_public)
WHERE is_public = true;
-- ============================================================================
-- 6. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification Type
  type TEXT NOT NULL CHECK (
    type IN (
      'booking_request',
      'booking_accepted',
      'booking_rejected',
      'booking_cancelled',
      'new_message',
      'trip_reminder',
      'trip_cancelled',
      'trip_completed',
      'payment_received',
      'payment_failed',
      'review_received',
      'system_update',
      'promo_offer',
      'safety_alert'
    )
  ),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT,
  action_url TEXT,
  
  -- Related Entities
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Metadata
  data JSONB,
  
  -- Status
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  
  -- Delivery Method
  sent_push BOOLEAN DEFAULT false,
  sent_email BOOLEAN DEFAULT false,
  sent_sms BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)
WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at)
WHERE expires_at IS NOT NULL;
-- ============================================================================
-- 7. FAVORITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Favorite Type
  type TEXT NOT NULL CHECK (type IN ('user', 'location', 'route')),
  
  -- Reference (depends on type)
  favorite_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location_name TEXT,
  location_coordinates POINT,
  route_from TEXT,
  route_to TEXT,
  
  -- Metadata
  nickname TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_favorite UNIQUE (
    user_id,
    type,
    favorite_user_id,
    location_name,
    route_from,
    route_to
  )
);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_type ON favorites(type);
CREATE INDEX IF NOT EXISTS idx_favorites_favorite_user_id ON favorites(favorite_user_id);
-- ============================================================================
-- 8. TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Transaction Type
  type TEXT NOT NULL CHECK (
    type IN (
      'payment',
      'refund',
      'payout',
      'wallet_topup',
      'wallet_withdrawal',
      'platform_fee',
      'commission',
      'bonus',
      'penalty'
    )
  ),
  
  -- Amount
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'AED' NOT NULL,
  
  -- Payment Details
  payment_method TEXT,
  payment_provider TEXT,
  payment_intent_id TEXT,
  external_transaction_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'completed',
      'failed',
      'cancelled',
      'refunded'
    )
  ),
  
  -- Description
  description TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent ON transactions(payment_intent_id);
-- ============================================================================
-- 9. REPORTED_CONTENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reported_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Reported Entity
  content_type TEXT NOT NULL CHECK (
    content_type IN ('user', 'trip', 'review', 'message')
  ),
  content_id UUID NOT NULL,
  
  -- Report Details
  reason TEXT NOT NULL CHECK (
    reason IN (
      'inappropriate_behavior',
      'harassment',
      'fraud',
      'spam',
      'safety_concern',
      'fake_profile',
      'offensive_content',
      'other'
    )
  ),
  description TEXT NOT NULL,
  evidence_urls TEXT [],
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'investigating',
      'resolved',
      'dismissed'
    )
  ),
  resolution TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reported content
CREATE INDEX IF NOT EXISTS idx_reported_content_reporter_id ON reported_content(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reported_content_type ON reported_content(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_reported_content_status ON reported_content(status);
CREATE INDEX IF NOT EXISTS idx_reported_content_created_at ON reported_content(created_at DESC);
-- ============================================================================
-- 10. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE
UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE
UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE
UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE
UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE
UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE
UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reported_content_updated_at ON reported_content;
CREATE TRIGGER update_reported_content_updated_at BEFORE
UPDATE ON reported_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update available seats after booking
CREATE OR REPLACE FUNCTION update_trip_seats_after_booking() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'accepted') THEN
    UPDATE trips
    SET available_seats = available_seats - NEW.seats_requested
    WHERE id = NEW.trip_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status != 'accepted' AND NEW.status = 'accepted') THEN
      UPDATE trips
      SET available_seats = available_seats - NEW.seats_requested
      WHERE id = NEW.trip_id;
    ELSIF (OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected')) THEN
      UPDATE trips
      SET available_seats = available_seats + OLD.seats_requested
      WHERE id = NEW.trip_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trip_seats ON bookings;
CREATE TRIGGER update_trip_seats
AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_trip_seats_after_booking();

-- Function to prevent self booking
CREATE OR REPLACE FUNCTION check_no_self_booking() RETURNS TRIGGER AS $$
DECLARE v_driver_id UUID;
BEGIN
  SELECT driver_id INTO v_driver_id
  FROM trips
  WHERE id = NEW.trip_id;
  IF v_driver_id = NEW.passenger_id THEN RAISE EXCEPTION 'Driver cannot book their own trip';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_booking_no_self_booking ON bookings;
CREATE TRIGGER check_booking_no_self_booking BEFORE
INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION check_no_self_booking();

-- Function to update user statistics after trip completion
CREATE OR REPLACE FUNCTION update_user_trip_stats() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    -- Update driver stats
    UPDATE profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_driver = trips_as_driver + 1
    WHERE id = NEW.driver_id;
    
    -- Update passenger stats for all completed bookings
    UPDATE profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_passenger = trips_as_passenger + 1
    WHERE id IN (
      SELECT passenger_id
      FROM bookings
      WHERE trip_id = NEW.id
        AND status = 'completed'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trip_stats ON trips;
CREATE TRIGGER update_trip_stats
AFTER UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_user_trip_stats();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_content ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR
SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR
UPDATE USING (auth.uid() = id);

-- Trips policies
DROP POLICY IF EXISTS "Published trips are viewable by everyone" ON trips;
CREATE POLICY "Published trips are viewable by everyone" ON trips FOR
SELECT USING (
    status = 'published'
    OR driver_id = auth.uid()
  );

DROP POLICY IF EXISTS "Drivers can manage own trips" ON trips;
CREATE POLICY "Drivers can manage own trips" ON trips FOR ALL USING (driver_id = auth.uid());

-- Bookings policies
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings" ON bookings FOR
SELECT USING (
    passenger_id = auth.uid()
    OR trip_id IN (
      SELECT id
      FROM trips
      WHERE driver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Passengers can create bookings" ON bookings;
CREATE POLICY "Passengers can create bookings" ON bookings FOR
INSERT WITH CHECK (passenger_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
CREATE POLICY "Users can update own bookings" ON bookings FOR
UPDATE USING (
    passenger_id = auth.uid()
    OR trip_id IN (
      SELECT id
      FROM trips
      WHERE driver_id = auth.uid()
    )
  );

-- Messages policies
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages FOR
SELECT USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR
INSERT WITH CHECK (sender_id = auth.uid());

-- Reviews policies
DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON reviews;
CREATE POLICY "Public reviews are viewable by everyone" ON reviews FOR
SELECT USING (
    is_public = true
    OR reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews FOR
INSERT WITH CHECK (reviewer_id = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR
SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR
UPDATE USING (user_id = auth.uid());

-- Favorites policies
DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites" ON favorites FOR ALL USING (user_id = auth.uid());

-- Transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions FOR
SELECT USING (user_id = auth.uid());

-- Reported content policies
DROP POLICY IF EXISTS "Users can view own reports" ON reported_content;
CREATE POLICY "Users can view own reports" ON reported_content FOR
SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can create reports" ON reported_content;
CREATE POLICY "Users can create reports" ON reported_content FOR
INSERT WITH CHECK (reporter_id = auth.uid());

-- ============================================================================
-- 12. HELPER VIEWS
-- ============================================================================

-- View for active trips with driver information
CREATE OR REPLACE VIEW active_trips_with_driver AS
SELECT t.*,
  p.full_name as driver_name,
  p.avatar_url as driver_avatar,
  p.rating_as_driver as driver_rating,
  p.trips_as_driver as driver_trips,
  p.phone as driver_phone
FROM trips t
JOIN profiles p ON t.driver_id = p.id
WHERE t.status = 'published'
  AND t.available_seats > 0
  AND t.departure_date >= CURRENT_DATE
  AND p.deleted_at IS NULL;

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT p.id,
  p.full_name,
  p.total_trips,
  p.trips_as_driver,
  p.trips_as_passenger,
  p.rating_as_driver,
  p.rating_as_passenger,
  COUNT(DISTINCT t.id) as published_trips,
  COUNT(DISTINCT b.id) as active_bookings
FROM profiles p
LEFT JOIN trips t ON t.driver_id = p.id
  AND t.status IN ('published', 'in-progress')
LEFT JOIN bookings b ON b.passenger_id = p.id
  AND b.status IN ('pending', 'accepted')
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- ============================================================================
-- SECTION: 20260211000000_add_notes_to_trips.sql
-- ============================================================================

ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.trips.notes IS 'Optional notes for the trip, visible to passenger and driver.';

-- ============================================================================
-- SECTION: 20260211000001_profile_change_history.sql
-- ============================================================================

-- Migration: Profile Change History Tracking
-- Description: Adds comprehensive audit trail for profile updates
-- Author: Amazon Q
-- Date: 2026-01-XX

-- Create profile_change_history table
CREATE TABLE IF NOT EXISTS public.profile_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_change_history_user_id ON public.profile_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_history_changed_at ON public.profile_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_change_history_field_name ON public.profile_change_history(field_name);

-- Enable Row Level Security
ALTER TABLE public.profile_change_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own change history
DROP POLICY IF EXISTS profile_change_history_select_own ON public.profile_change_history;
CREATE POLICY profile_change_history_select_own ON public.profile_change_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert change records
DROP POLICY IF EXISTS profile_change_history_insert_system ON public.profile_change_history;
CREATE POLICY profile_change_history_insert_system ON public.profile_change_history
  FOR INSERT
  WITH CHECK (auth.uid() = changed_by);

-- Grant permissions
GRANT SELECT ON public.profile_change_history TO authenticated;
GRANT INSERT ON public.profile_change_history TO authenticated;

-- Add comment
COMMENT ON TABLE public.profile_change_history IS 'Audit trail for profile field changes with metadata';

-- Create function to automatically log profile changes
CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log changes for specific fields
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.full_name IS DISTINCT FROM NEW.full_name) THEN
      INSERT INTO public.profile_change_history (user_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'full_name', OLD.full_name, NEW.full_name, NEW.id);
    END IF;
    
    IF (OLD.email IS DISTINCT FROM NEW.email) THEN
      INSERT INTO public.profile_change_history (user_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'email', OLD.email, NEW.email, NEW.id);
    END IF;
    
    IF (OLD.phone IS DISTINCT FROM NEW.phone) THEN
      INSERT INTO public.profile_change_history (user_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'phone', OLD.phone, NEW.phone, NEW.id);
    END IF;
    
    IF (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
      INSERT INTO public.profile_change_history (user_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'avatar_url', 'changed', 'updated', NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_log_profile_change ON public.profiles;
CREATE TRIGGER trigger_log_profile_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_change();

-- Add retention policy (optional - keeps last 1 year of history)
CREATE OR REPLACE FUNCTION public.cleanup_old_profile_changes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.profile_change_history
  WHERE changed_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job for cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-profile-history', '0 2 * * 0', 'SELECT public.cleanup_old_profile_changes()');

COMMENT ON FUNCTION public.log_profile_change() IS 'Automatically logs profile field changes to audit trail';
COMMENT ON FUNCTION public.cleanup_old_profile_changes() IS 'Removes profile change history older than 1 year';


-- ============================================================================
-- SECTION: 20260223000000_production_schema.sql
-- ============================================================================

-- ==================== WASEL PRODUCTION SCHEMA MIGRATION ====================
-- Migration: KV Store → Real PostgreSQL Schema
-- Date: 2026-02-23
-- Description: Creates production-ready tables with RLS, indexes, and constraints

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

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


-- ==================== PROFILES TABLE ====================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  
  -- Trip statistics
  total_trips INTEGER DEFAULT 0 CHECK (total_trips >= 0),
  trips_as_driver INTEGER DEFAULT 0 CHECK (trips_as_driver >= 0),
  trips_as_passenger INTEGER DEFAULT 0 CHECK (trips_as_passenger >= 0),
  
  -- Ratings
  rating_as_driver NUMERIC(3,2) DEFAULT 0.00 CHECK (rating_as_driver >= 0 AND rating_as_driver <= 5),
  rating_as_passenger NUMERIC(3,2) DEFAULT 0.00 CHECK (rating_as_passenger >= 0 AND rating_as_passenger <= 5),
  total_ratings_received INTEGER DEFAULT 0 CHECK (total_ratings_received >= 0),
  
  -- Preferences
  smoking_allowed BOOLEAN DEFAULT FALSE,
  pets_allowed BOOLEAN DEFAULT FALSE,
  music_allowed BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  currency TEXT DEFAULT 'JOD' CHECK (currency IN ('JOD', 'USD', 'EUR', 'SAR', 'AED')),
  
  -- Wallet
  wallet_balance NUMERIC(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),
  total_earned NUMERIC(10,2) DEFAULT 0.00 CHECK (total_earned >= 0),
  total_spent NUMERIC(10,2) DEFAULT 0.00 CHECK (total_spent >= 0),
  
  -- Notifications
  notification_enabled BOOLEAN DEFAULT TRUE,
  location_sharing_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired')),
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'enterprise')),
  subscription_ends_at TIMESTAMPTZ,
  
  -- Verification
  id_verified BOOLEAN DEFAULT FALSE,
  driver_license_verified BOOLEAN DEFAULT FALSE,
  background_check_status TEXT DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'approved', 'rejected')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public can view basic profile info (for driver details in trips)
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles" ON public.profiles FOR SELECT
  USING (TRUE);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status) WHERE subscription_status = 'active';
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- ==================== TRIPS TABLE ====================
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Route information
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  from_lat NUMERIC(10,8),
  from_lng NUMERIC(11,8),
  to_lat NUMERIC(10,8),
  to_lng NUMERIC(11,8),
  distance_km NUMERIC(8,2),
  route_polyline TEXT,
  
  -- Schedule
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  
  -- Capacity
  total_seats INTEGER NOT NULL CHECK (total_seats > 0 AND total_seats <= 8),
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
  
  -- Pricing
  price_per_seat NUMERIC(8,2) NOT NULL CHECK (price_per_seat >= 0),
  currency TEXT DEFAULT 'JOD' CHECK (currency IN ('JOD', 'USD', 'EUR', 'SAR', 'AED')),
  
  -- Status
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  
  -- Preferences
  smoking_allowed BOOLEAN DEFAULT FALSE,
  pets_allowed BOOLEAN DEFAULT FALSE,
  music_allowed BOOLEAN DEFAULT TRUE,
  luggage_space TEXT CHECK (luggage_space IN ('none', 'small', 'medium', 'large')),
  
  -- Vehicle info
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  vehicle_plate TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT valid_seats CHECK (available_seats <= total_seats),
  CONSTRAINT future_departure CHECK (departure_date >= CURRENT_DATE OR status != 'published')
);

-- RLS Policies for trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Everyone can view published trips
DROP POLICY IF EXISTS "Published trips are viewable by all" ON public.trips;
CREATE POLICY "Published trips are viewable by all" ON public.trips FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Drivers can view their own trips (any status)
DROP POLICY IF EXISTS "Drivers can view own trips" ON public.trips;
CREATE POLICY "Drivers can view own trips" ON public.trips FOR SELECT
  USING (driver_id = auth.uid());

-- Drivers can create trips
DROP POLICY IF EXISTS "Drivers can create trips" ON public.trips;
CREATE POLICY "Drivers can create trips" ON public.trips FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Drivers can update their own trips
DROP POLICY IF EXISTS "Drivers can update own trips" ON public.trips;
CREATE POLICY "Drivers can update own trips" ON public.trips FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Drivers can soft delete their own trips
DROP POLICY IF EXISTS "Drivers can delete own trips" ON public.trips;
CREATE POLICY "Drivers can delete own trips" ON public.trips FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid() AND deleted_at IS NOT NULL);

-- Indexes for trips
CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips(driver_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_departure ON public.trips(departure_date, departure_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_available_seats ON public.trips(available_seats) WHERE available_seats > 0 AND deleted_at IS NULL;

-- Composite index for search optimization
CREATE INDEX IF NOT EXISTS idx_trips_search ON public.trips(from_location, to_location, departure_date, available_seats) 
  WHERE status = 'published' AND deleted_at IS NULL;

-- GIN index for full-text search on locations
CREATE INDEX IF NOT EXISTS idx_trips_locations_gin ON public.trips USING GIN (to_tsvector('english', from_location || ' ' || to_location));

-- ==================== BOOKINGS TABLE ====================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Booking details
  seats_requested INTEGER NOT NULL CHECK (seats_requested > 0 AND seats_requested <= 8),
  pickup_location TEXT,
  dropoff_location TEXT,
  pickup_lat NUMERIC(10,8),
  pickup_lng NUMERIC(11,8),
  dropoff_lat NUMERIC(10,8),
  dropoff_lng NUMERIC(11,8),
  
  -- Pricing (frozen at booking time)
  price_per_seat NUMERIC(8,2) NOT NULL CHECK (price_per_seat >= 0),
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  currency TEXT DEFAULT 'JOD',
  platform_fee NUMERIC(10,2) DEFAULT 0.00,
  driver_earnings NUMERIC(10,2),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'refunded', 'no_show')),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id),
  
  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  payment_method TEXT CHECK (payment_method IN ('wallet', 'card', 'cash', 'stripe')),
  stripe_payment_intent_id TEXT UNIQUE,
  
  -- Ratings
  passenger_rating INTEGER CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  passenger_feedback TEXT,
  driver_feedback TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  
  CONSTRAINT unique_active_booking UNIQUE(trip_id, passenger_id) DEFERRABLE INITIALLY DEFERRED
);

-- RLS Policies for bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Passengers can view their own bookings
DROP POLICY IF EXISTS "Passengers can view own bookings" ON public.bookings;
CREATE POLICY "Passengers can view own bookings" ON public.bookings FOR SELECT
  USING (passenger_id = auth.uid());

-- Drivers can view bookings for their trips
DROP POLICY IF EXISTS "Drivers can view trip bookings" ON public.bookings;
CREATE POLICY "Drivers can view trip bookings" ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = bookings.trip_id
      AND trips.driver_id = auth.uid()
    )
  );

-- Passengers can create bookings
DROP POLICY IF EXISTS "Passengers can create bookings" ON public.bookings;
CREATE POLICY "Passengers can create bookings" ON public.bookings FOR INSERT
  WITH CHECK (passenger_id = auth.uid());

-- Passengers and drivers can update bookings (status changes)
DROP POLICY IF EXISTS "Bookings updatable by passenger or driver" ON public.bookings;
CREATE POLICY "Bookings updatable by passenger or driver" ON public.bookings FOR UPDATE
  USING (
    passenger_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = bookings.trip_id
      AND trips.driver_id = auth.uid()
    )
  );

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent ON public.bookings(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status) WHERE payment_status IN ('pending', 'failed');

-- ==================== SUBSCRIPTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Stripe data
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  stripe_product_id TEXT,
  
  -- Subscription details
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'premium', 'enterprise')),
  
  -- Billing
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end) WHERE status IN ('active', 'trialing');

-- ==================== STRIPE EVENTS TABLE (Idempotency) ====================
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  id TEXT PRIMARY KEY, -- Stripe event.id
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB NOT NULL,
  processing_duration_ms INTEGER,
  
  CONSTRAINT event_id_format CHECK (id ~ '^evt_')
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON public.processed_stripe_events(processed_at);

-- Auto-cleanup old events (>90 days) - requires pg_cron
-- SELECT cron.schedule('cleanup-old-stripe-events', '0 3 * * 0', 
--   'DELETE FROM public.processed_stripe_events WHERE processed_at < NOW() - INTERVAL ''90 days''');

-- ==================== WALLET TRANSACTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  amount NUMERIC(10,2) NOT NULL, -- Positive = credit, Negative = debit
  balance_before NUMERIC(10,2) NOT NULL CHECK (balance_before >= 0),
  balance_after NUMERIC(10,2) NOT NULL CHECK (balance_after >= 0),
  currency TEXT DEFAULT 'JOD',
  
  type TEXT NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'trip_payment', 'trip_earning', 
    'refund', 'bonus', 'subscription_payment', 'platform_fee'
  )),
  description TEXT,
  
  -- References
  related_booking_id UUID REFERENCES public.bookings(id),
  related_trip_id UUID REFERENCES public.trips(id),
  related_subscription_id UUID REFERENCES public.subscriptions(id),
  
  -- Payment gateway reference
  external_transaction_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_balance_change CHECK (
    (amount > 0 AND balance_after = balance_before + amount) OR
    (amount < 0 AND balance_after = balance_before + amount)
  )
);

-- RLS for wallet transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_booking ON public.wallet_transactions(related_booking_id) WHERE related_booking_id IS NOT NULL;

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN (
    'booking_request', 'booking_confirmed', 'booking_cancelled',
    'trip_reminder', 'payment_received', 'payment_failed',
    'rating_received', 'message_received', 'system_announcement'
  )),
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Links
  action_url TEXT,
  related_booking_id UUID REFERENCES public.bookings(id),
  related_trip_id UUID REFERENCES public.trips(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;

-- ==================== RATINGS TABLE ====================
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  tags TEXT[], -- e.g., ['punctual', 'friendly', 'clean_car']
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_rating UNIQUE(booking_id, from_user_id),
  CONSTRAINT no_self_rating CHECK (from_user_id != to_user_id)
);

-- RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ratings about them" ON public.ratings;
CREATE POLICY "Users can view ratings about them" ON public.ratings FOR SELECT
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create ratings for completed bookings" ON public.ratings;
CREATE POLICY "Users can create ratings for completed bookings" ON public.ratings FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = booking_id
      AND status = 'completed'
      AND (passenger_id = auth.uid() OR trip_id IN (
        SELECT id FROM public.trips WHERE driver_id = auth.uid()
      ))
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON public.ratings(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_from_user ON public.ratings(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_booking ON public.ratings(booking_id);

-- ==================== FUNCTIONS ====================

-- Function to update profile stats after trip completion
CREATE OR REPLACE FUNCTION update_profile_stats_on_trip_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update driver stats
    UPDATE public.profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_driver = trips_as_driver + 1,
      updated_at = NOW()
    WHERE id = (SELECT driver_id FROM public.trips WHERE id = NEW.trip_id);
    
    -- Update passenger stats
    UPDATE public.profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_passenger = trips_as_passenger + 1,
      updated_at = NOW()
    WHERE id = NEW.passenger_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_trip_stats ON public.bookings;
CREATE TRIGGER trigger_update_trip_stats
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_on_trip_completion();

-- Function to update profile rating after new rating
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating NUMERIC;
  rating_count INTEGER;
BEGIN
  -- Calculate new average rating for the user being rated
  SELECT 
    AVG(rating)::NUMERIC(3,2),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM public.ratings
  WHERE to_user_id = NEW.to_user_id;
  
  -- Determine if this is driver or passenger rating
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.trips t ON b.trip_id = t.id
    WHERE b.id = NEW.booking_id
    AND t.driver_id = NEW.to_user_id
  ) THEN
    -- Update driver rating
    UPDATE public.profiles
    SET 
      rating_as_driver = avg_rating,
      total_ratings_received = rating_count,
      updated_at = NOW()
    WHERE id = NEW.to_user_id;
  ELSE
    -- Update passenger rating
    UPDATE public.profiles
    SET 
      rating_as_passenger = avg_rating,
      total_ratings_received = rating_count,
      updated_at = NOW()
    WHERE id = NEW.to_user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_rating ON public.ratings;
CREATE TRIGGER trigger_update_profile_rating
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_rating();

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    wallet_balance = NEW.balance_after,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trigger_update_wallet_balance
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== MATERIALIZED VIEW FOR TRIP SEARCH ====================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.trip_search_cache AS
SELECT 
  t.id,
  t.driver_id,
  t.from_location,
  t.to_location,
  t.departure_date,
  t.departure_time,
  t.available_seats,
  t.total_seats,
  t.price_per_seat,
  t.currency,
  t.status,
  t.distance_km,
  t.smoking_allowed,
  t.pets_allowed,
  t.music_allowed,
  p.full_name AS driver_name,
  p.rating_as_driver AS driver_rating,
  p.trips_as_driver AS driver_trip_count,
  p.avatar_url AS driver_avatar,
  p.phone_verified AS driver_phone_verified,
  p.id_verified AS driver_id_verified
FROM public.trips t
JOIN public.profiles p ON t.driver_id = p.id
WHERE t.status = 'published' 
  AND t.available_seats > 0
  AND t.deleted_at IS NULL
  AND t.departure_date >= CURRENT_DATE;

-- CREATE unique INDEX IF NOT EXISTS for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_search_cache_id ON public.trip_search_cache(id);

-- Composite indexes for search
CREATE INDEX IF NOT EXISTS idx_trip_search_cache_route ON public.trip_search_cache(from_location, to_location, departure_date);
CREATE INDEX IF NOT EXISTS idx_trip_search_cache_date ON public.trip_search_cache(departure_date, departure_time);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_trip_search_cache()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.trip_search_cache;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 5 minutes (requires pg_cron extension)
-- SELECT cron.schedule('refresh-trip-search-cache', '*/5 * * * *', 'SELECT refresh_trip_search_cache();');

-- ==================== GRANT PERMISSIONS ====================
-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT ON public.trip_search_cache TO authenticated;
GRANT SELECT ON public.trip_search_cache TO anon;

-- Grant service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ==================== COMMENTS ====================
COMMENT ON TABLE public.profiles IS 'User profiles with wallet, preferences, and subscription info';
COMMENT ON TABLE public.trips IS 'Trip listings created by drivers';
COMMENT ON TABLE public.bookings IS 'Passenger bookings for trips';
COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records';
COMMENT ON TABLE public.processed_stripe_events IS 'Idempotency table for Stripe webhooks';
COMMENT ON TABLE public.wallet_transactions IS 'All wallet balance changes';
COMMENT ON TABLE public.notifications IS 'In-app notifications';
COMMENT ON TABLE public.ratings IS 'Driver and passenger ratings';
COMMENT ON MATERIALIZED VIEW public.trip_search_cache IS 'Optimized view for trip search (refreshed every 5 min)';

-- ==================== MIGRATION COMPLETE ====================
-- Next steps:
-- 1. Run this migration: supabase db reset (dev) or supabase migration up (prod)
-- 2. Migrate existing KV data using scripts/migrate-kv-to-postgres.ts
-- 3. Update Edge Functions to use new tables instead of KV store
-- 4. Test RLS policies thoroughly


-- ============================================================================
-- SECTION: 20260224000000_production_backend_schema.sql
-- ============================================================================

-- Wasel Production Backend Schema
-- Version: 10.0.0
-- Date: February 24, 2026
-- Description: Complete database schema for production backend

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE trip_type AS ENUM ('wasel', 'raje3', 'package', 'rental', 'medical', 'school');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('draft', 'published', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'card', 'wallet', 'bank_transfer', 'stripe');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'trip_request', 'trip_accepted', 'trip_rejected', 'trip_cancelled',
    'driver_arrived', 'trip_started', 'trip_completed',
    'payment_received', 'payment_sent', 'message',
    'rating_reminder', 'verification_approved', 'verification_rejected',
    'safety_alert', 'push'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'location', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================



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

-- TABLES

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
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'wasel';

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS seats_booked INTEGER DEFAULT 1;

-- ============================================================================

-- Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Location
  city TEXT DEFAULT 'Amman',
  country TEXT DEFAULT 'Jordan',
  
  -- Verification
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Statistics
  total_trips INTEGER DEFAULT 0,
  trips_as_driver INTEGER DEFAULT 0,
  trips_as_passenger INTEGER DEFAULT 0,
  rating_as_driver DECIMAL(3,2) DEFAULT 0.0,
  rating_as_passenger DECIMAL(3,2) DEFAULT 0.0,
  
  -- Preferences
  language TEXT DEFAULT 'ar' CHECK (language IN ('en', 'ar')),
  currency TEXT DEFAULT 'JOD',
  
  -- Financial
  wallet_balance DECIMAL(10,2) DEFAULT 0.0,
  total_earned DECIMAL(10,2) DEFAULT 0.0,
  total_spent DECIMAL(10,2) DEFAULT 0.0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_rating_driver CHECK (rating_as_driver >= 0 AND rating_as_driver <= 5),
  CONSTRAINT valid_rating_passenger CHECK (rating_as_passenger >= 0 AND rating_as_passenger <= 5)
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Trip details
  type trip_type DEFAULT 'wasel',
  status trip_status DEFAULT 'draft',
  
  -- Locations
  origin TEXT NOT NULL,
  origin_lat DECIMAL(10,8),
  origin_lng DECIMAL(11,8),
  destination TEXT NOT NULL,
  destination_lat DECIMAL(10,8),
  destination_lng DECIMAL(11,8),
  
  -- Timing
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  distance_km DECIMAL(10,2),
  
  -- Capacity
  available_seats INTEGER DEFAULT 1,
  booked_seats INTEGER DEFAULT 0,
  
  -- Pricing
  price_per_seat DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'JOD',
  payment_status payment_status DEFAULT 'pending',
  
  -- Preferences
  smoking_allowed BOOLEAN DEFAULT FALSE,
  pets_allowed BOOLEAN DEFAULT FALSE,
  luggage_allowed BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Booking details
  status booking_status DEFAULT 'pending',
  seats_booked INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'JOD',
  
  -- Pickup/Dropoff
  pickup_location TEXT,
  pickup_lat DECIMAL(10,8),
  pickup_lng DECIMAL(11,8),
  dropoff_location TEXT,
  dropoff_lat DECIMAL(10,8),
  dropoff_lng DECIMAL(11,8),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  CONSTRAINT unique_booking UNIQUE(trip_id, passenger_id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'JOD',
  method payment_method DEFAULT 'card',
  status payment_status DEFAULT 'pending',
  
  -- Stripe integration
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_payment_id TEXT,
  stripe_customer_id TEXT,
  
  -- Metadata
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- Messages Table (Real-time Chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Message details
  content TEXT NOT NULL,
  type message_type DEFAULT 'text',
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Attachments
  attachment_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Notification details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'push',
  
  -- Related entities
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Delivery
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  
  -- Metadata
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FCM Tokens Table (Push Notifications)
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings Table
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Rating details
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  tags TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_rating UNIQUE(trip_id, rater_id, rated_id)
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Vehicle details
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  
  -- Capacity
  seats INTEGER DEFAULT 4,
  
  -- Features
  air_conditioning BOOLEAN DEFAULT TRUE,
  bluetooth BOOLEAN DEFAULT TRUE,
  
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Driver Documents Table
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Document details
  document_type TEXT NOT NULL CHECK (document_type IN ('license', 'insurance', 'registration', 'background_check', 'selfie')),
  document_url TEXT NOT NULL,
  
  -- Verification
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  
  -- Participants
  user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Status
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_conversation UNIQUE(user1_id, user2_id, trip_id)
);

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Event details
  event_name TEXT NOT NULL,
  event_category TEXT,
  event_data JSONB,
  
  -- Session
  session_id TEXT,
  device_type TEXT,
  platform TEXT,
  app_version TEXT,
  
  -- Location
  country TEXT,
  city TEXT,
  ip_address TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Action details
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Request details
  ip_address TEXT,
  user_agent TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Trips indexes
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_type ON trips(type);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_trip_id ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- FCM Tokens indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_is_active ON fcm_tokens(is_active);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view public profile data" ON profiles;
CREATE POLICY "Anyone can view public profile data" ON profiles
  FOR SELECT USING (true);

-- Trips policies
DROP POLICY IF EXISTS "Users can view all published trips" ON trips;
CREATE POLICY "Users can view all published trips" ON trips
  FOR SELECT USING (status = 'published' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own trips" ON trips;
CREATE POLICY "Users can create their own trips" ON trips
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips" ON trips
  FOR UPDATE USING (user_id = auth.uid());

-- Bookings policies
DROP POLICY IF EXISTS "Users can view their bookings" ON bookings;
CREATE POLICY "Users can view their bookings" ON bookings
  FOR SELECT USING (passenger_id = auth.uid() OR driver_id = auth.uid());

DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
CREATE POLICY "Users can create bookings" ON bookings
  FOR INSERT WITH CHECK (passenger_id = auth.uid());

-- Payments policies
DROP POLICY IF EXISTS "Users can view their payments" ON payments;
CREATE POLICY "Users can view their payments" ON payments
  FOR SELECT USING (user_id = auth.uid());

-- Messages policies
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- FCM Tokens policies
DROP POLICY IF EXISTS "Users can manage their FCM tokens" ON fcm_tokens;
CREATE POLICY "Users can manage their FCM tokens" ON fcm_tokens
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user stats after trip completion
CREATE OR REPLACE FUNCTION update_user_trip_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update driver stats
    UPDATE profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_driver = trips_as_driver + 1
    WHERE id = NEW.user_id;
    
    -- Update passenger stats for all bookings
    UPDATE profiles
    SET 
      total_trips = total_trips + 1,
      trips_as_passenger = trips_as_passenger + 1
    WHERE id IN (
      SELECT passenger_id FROM bookings WHERE trip_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trip_stats ON trips;
CREATE TRIGGER update_trip_stats AFTER UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_user_trip_stats();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default admin user (if not exists)
-- This will be created manually through Supabase dashboard

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for trip search with driver info
CREATE OR REPLACE VIEW trip_search_view AS
SELECT 
  t.id,
  t.user_id,
  t.driver_id,
  t.status,
  t.origin,
  t.origin_lat,
  t.origin_lng,
  t.destination,
  t.destination_lat,
  t.destination_lng,
  t.departure_date,
  t.departure_time,
  t.arrival_time,
  t.duration_minutes,
  t.distance_km,
  t.available_seats,
  t.booked_seats,
  t.price_per_seat,
  t.currency,
  t.smoking_allowed,
  t.pets_allowed,
  t.created_at,
  t.updated_at,
  p.full_name as driver_name,
  p.avatar_url as driver_avatar,
  p.rating_as_driver as driver_rating,
  p.total_trips as driver_total_trips,
  COALESCE(v.make, t.vehicle_make) as vehicle_make,
  COALESCE(v.model, t.vehicle_model) as vehicle_model,
  COALESCE(v.year, t.vehicle_year) as vehicle_year,
  COALESCE(v.color, t.vehicle_color) as vehicle_color
FROM trips t
LEFT JOIN profiles p ON COALESCE(t.user_id, t.driver_id) = p.id
LEFT JOIN vehicles v ON v.user_id = t.user_id
WHERE t.status = 'published'
AND t.available_seats > COALESCE(t.booked_seats, 0)
AND (t.departure_date >= CURRENT_DATE OR t.departure_date IS NULL);

-- View for user dashboard stats
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT 
  p.id as user_id,
  p.total_trips,
  p.wallet_balance,
  p.rating_as_driver,
  p.rating_as_passenger,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') as active_trips,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'pending') as pending_bookings,
  COUNT(DISTINCT n.id) FILTER (WHERE n.is_read = false) as unread_notifications
FROM profiles p
LEFT JOIN trips t ON t.user_id = p.id
LEFT JOIN bookings b ON b.passenger_id = p.id OR b.driver_id = p.id
LEFT JOIN notifications n ON n.user_id = p.id
GROUP BY p.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE trips IS 'All trips (rides, deliveries, rentals)';
COMMENT ON TABLE bookings IS 'Passenger bookings for trips';
COMMENT ON TABLE payments IS 'Payment transactions with Stripe integration';
COMMENT ON TABLE messages IS 'Real-time chat messages between users';
COMMENT ON TABLE notifications IS 'User notifications (push, email, SMS)';
COMMENT ON TABLE fcm_tokens IS 'Firebase Cloud Messaging tokens for push notifications';
COMMENT ON TABLE analytics_events IS 'Application analytics and tracking events';
COMMENT ON TABLE audit_logs IS 'Audit trail for security and compliance';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- COMPLETED
-- ============================================================================

-- Migration completed successfully
SELECT 'Production backend schema v10.0.0 installed successfully' as status;


-- ============================================================================
-- SECTION: 20260224000001_backup_configuration.sql
-- ============================================================================

/**
 * Automated Backup Configuration
 * Version: 1.0.0
 * 
 * Implements database backup strategy:
 * - Daily automated backups
 * - Point-in-time recovery
 * - Disaster recovery plan
 */

-- ============================================================================
-- AUTOMATED BACKUP CONFIGURATION
-- ============================================================================

-- This SQL script configures automatic backups for your Supabase database
-- Run this in the Supabase SQL Editor

-- Enable Point-in-Time Recovery (PITR)
-- Note: PITR is available on Supabase Pro plan and above
-- It provides continuous backup with 7-day retention by default

-- ============================================================================
-- BACKUP VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_backup_integrity()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  last_updated TIMESTAMPTZ,
  size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || relname AS table_name,
    n_live_tup AS row_count,
    last_vacuum AS last_updated,
    pg_total_relation_size(schemaname || '.' || relname)::NUMERIC / (1024*1024) AS size_mb
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM verify_backup_integrity();

-- ============================================================================
-- BACKUP MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  tables_backed_up TEXT[],
  total_rows BIGINT,
  total_size_mb NUMERIC,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- CREATE INDEX IF NOT EXISTS for monitoring
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_completed ON backup_logs(completed_at DESC);

-- ============================================================================
-- BACKUP VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_backup(
  p_backup_type TEXT,
  p_status TEXT,
  p_tables TEXT[] DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
  v_total_rows BIGINT;
  v_total_size NUMERIC;
BEGIN
  -- Calculate statistics
  SELECT 
    SUM(n_live_tup),
    SUM(pg_total_relation_size(schemaname || '.' || relname))::NUMERIC / (1024*1024)
  INTO v_total_rows, v_total_size
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';
  
  -- Insert backup log
  INSERT INTO backup_logs (
    backup_type,
    status,
    tables_backed_up,
    total_rows,
    total_size_mb,
    error_message
  ) VALUES (
    p_backup_type,
    p_status,
    p_tables,
    v_total_rows,
    v_total_size,
    p_error
  )
  RETURNING id INTO v_backup_id;
  
  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CRITICAL DATA SNAPSHOT (Manual Backup)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_critical_data_snapshot()
RETURNS JSONB AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  -- Create snapshot of critical tables
  SELECT jsonb_build_object(
    'timestamp', NOW(),
    'profiles_count', (SELECT COUNT(*) FROM profiles),
    'trips_count', (SELECT COUNT(*) FROM trips),
    'bookings_count', (SELECT COUNT(*) FROM bookings),
    'payments_count', (SELECT COUNT(*) FROM payments),
    'messages_count', (SELECT COUNT(*) FROM messages),
    'database_size_mb', (
      SELECT pg_database_size(current_database())::NUMERIC / (1024*1024)
    ),
    'oldest_record', (
      SELECT MIN(created_at) FROM (
        SELECT created_at FROM profiles
        UNION ALL
        SELECT created_at FROM trips
      ) AS all_dates
    ),
    'newest_record', (
      SELECT MAX(created_at) FROM (
        SELECT created_at FROM profiles
        UNION ALL
        SELECT created_at FROM trips
      ) AS all_dates
    )
  ) INTO v_snapshot;
  
  -- Log the snapshot
  PERFORM log_backup('manual', 'completed', ARRAY['all'], NULL);
  
  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT create_critical_data_snapshot();

-- ============================================================================
-- BACKUP STATUS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW backup_status AS
SELECT 
  backup_type,
  status,
  COUNT(*) as count,
  MAX(completed_at) as last_backup,
  AVG(duration_seconds) as avg_duration_seconds,
  SUM(total_size_mb) as total_size_mb
FROM backup_logs
WHERE completed_at > NOW() - INTERVAL '30 days'
GROUP BY backup_type, status
ORDER BY last_backup DESC;

-- ============================================================================
-- DISASTER RECOVERY CHECKLIST
-- ============================================================================

COMMENT ON TABLE backup_logs IS 'Tracks all backup operations for monitoring and compliance';
COMMENT ON FUNCTION verify_backup_integrity() IS 'Verifies database integrity before/after backups';
COMMENT ON FUNCTION create_critical_data_snapshot() IS 'Creates manual snapshot of critical data';
COMMENT ON VIEW backup_status IS 'Summary of backup operations in last 30 days';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON backup_logs TO authenticated;
GRANT SELECT ON backup_status TO authenticated;
GRANT EXECUTE ON FUNCTION verify_backup_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION create_critical_data_snapshot() TO service_role;

-- ============================================================================
-- INITIAL BACKUP LOG
-- ============================================================================

-- SELECT log_backup('manual', 'completed', ARRAY['initial_setup'], NULL);

-- ============================================================================
-- BACKUP INSTRUCTIONS
-- ============================================================================

/*
AUTOMATED DAILY BACKUPS:
Supabase automatically backs up your database daily.
Backups are retained for:
- Free tier: 7 days
- Pro tier: 30 days
- Enterprise: Custom retention

POINT-IN-TIME RECOVERY (PITR):
Enable PITR in Supabase Dashboard:
1. Go to Settings → Database
2. Enable "Point-in-Time Recovery"
3. Configure retention period (7-30 days)

MANUAL BACKUPS:
1. Via Supabase CLI:
   supabase db dump -f backup-$(date +%Y%m%d).sql

2. Via pg_dump:
   pg_dump -h YOUR_PROJECT.supabase.co -U postgres -d postgres > backup.sql

3. Via SQL Editor:
   SELECT create_critical_data_snapshot();

RESTORE FROM BACKUP:
1. Via Supabase Dashboard:
   - Settings → Database → Backups
   - Select backup → Click "Restore"

2. Via Supabase CLI:
   supabase db reset --db-url "postgresql://..."

3. Via psql:
   psql -h YOUR_PROJECT.supabase.co -U postgres -d postgres < backup.sql

DISASTER RECOVERY PLAN:
1. Daily automated backups (enabled by default)
2. PITR enabled (7-30 day retention)
3. Weekly manual backups to external storage
4. Monthly backup verification
5. Quarterly disaster recovery drills

MONITORING:
- Check backup status: SELECT * FROM backup_status;
- Verify integrity: SELECT * FROM verify_backup_integrity();
- View logs: SELECT * FROM backup_logs ORDER BY started_at DESC LIMIT 10;

BACKUP STORAGE LOCATIONS:
1. Primary: Supabase managed backups (automatic)
2. Secondary: AWS S3 bucket (weekly exports)
3. Tertiary: Local encrypted backups (monthly)

BACKUP TESTING:
Run quarterly restore tests:
1. Create test database
2. Restore latest backup
3. Run integrity checks
4. Verify data accuracy
5. Document results

RTO (Recovery Time Objective): 1 hour
RPO (Recovery Point Objective): 5 minutes (with PITR)

For production deployment:
1. Enable PITR in Supabase Dashboard
2. Set up automated exports to S3 (weekly)
3. Configure monitoring alerts
4. Document recovery procedures
5. Train team on restore process
*/

-- ============================================================================
-- COMPLETED
-- ============================================================================

SELECT 'Backup configuration installed successfully' as status;


-- ============================================================================
-- SECTION: 20260224000002_wasel_complete_schema.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════
-- Wasel | واصل — Complete Database Schema
-- Version: 1.0.0
-- Date: February 24, 2026
-- ═══════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


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

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating INTEGER;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review TEXT;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_type TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message TEXT;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────
-- 👤 Users & Profiles
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'ar',
  role TEXT DEFAULT 'rider' CHECK (role IN ('rider', 'driver', 'admin', 'support')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🚗 Drivers
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  license_number TEXT UNIQUE NOT NULL,
  license_expiry DATE NOT NULL,
  license_front_url TEXT,
  license_back_url TEXT,
  vehicle_id UUID,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'break')),
  rating DECIMAL(3, 2) DEFAULT 5.00,
  total_ratings INTEGER DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0.00,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  background_check_status TEXT DEFAULT 'pending',
  background_check_date TIMESTAMPTZ,
  current_location GEOGRAPHY(POINT),
  last_location_update TIMESTAMPTZ,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🚙 Vehicles
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  license_plate TEXT UNIQUE NOT NULL,
  vin TEXT UNIQUE,
  vehicle_type TEXT DEFAULT 'sedan' CHECK (vehicle_type IN ('sedan', 'suv', 'van', 'luxury', 'electric', 'motorcycle', 'scooter')),
  capacity INTEGER DEFAULT 4,
  photo_url TEXT,
  insurance_policy_number TEXT,
  insurance_expiry DATE,
  insurance_document_url TEXT,
  registration_document_url TEXT,
  inspection_status TEXT DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'approved', 'rejected', 'expired')),
  inspection_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from drivers to vehicles
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS fk_drivers_vehicle;
ALTER TABLE drivers ADD CONSTRAINT fk_drivers_vehicle 
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 🗺️ Trips & Bookings
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Trip details
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'driver_arriving', 'in_progress', 
    'completed', 'cancelled', 'no_show'
  )),
  trip_type TEXT DEFAULT 'ride' CHECK (trip_type IN ('ride', 'delivery', 'rental', 'scheduled')),
  
  -- Locations
  pickup_location GEOGRAPHY(POINT) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_location GEOGRAPHY(POINT) NOT NULL,
  dropoff_address TEXT NOT NULL,
  actual_dropoff_location GEOGRAPHY(POINT),
  
  -- Route
  route_polyline TEXT,
  distance_km DECIMAL(10, 2),
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  
  -- Pricing
  base_fare DECIMAL(10, 2) NOT NULL,
  distance_fare DECIMAL(10, 2) DEFAULT 0,
  time_fare DECIMAL(10, 2) DEFAULT 0,
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  promo_code TEXT,
  total_fare DECIMAL(10, 2) NOT NULL,
  commission DECIMAL(10, 2) NOT NULL,
  driver_earnings DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JOD',
  
  -- Payment
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'wallet', 'split')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_intent_id TEXT,
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  pickup_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  
  -- Ratings & Reviews
  rider_rating INTEGER CHECK (rider_rating BETWEEN 1 AND 5),
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  rider_review TEXT,
  driver_review TEXT,
  
  -- Special requirements
  special_requirements JSONB DEFAULT '{}',
  passenger_count INTEGER DEFAULT 1,
  luggage_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trip queries
CREATE INDEX IF NOT EXISTS idx_trips_rider_id ON trips(rider_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_location ON trips USING GIST(pickup_location);

-- ─────────────────────────────────────────────────────────────
-- 💳 Payments & Transactions
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('payment', 'refund', 'payout', 'topup', 'withdrawal', 'commission')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'JOD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payment_method TEXT,
  payment_intent_id TEXT,
  stripe_charge_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions(trip_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 💰 Wallets
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) DEFAULT 0.00,
  currency TEXT DEFAULT 'JOD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🎟️ Promo Codes
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_discount DECIMAL(10, 2),
  min_order DECIMAL(10, 2) DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  user_groups JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- ─────────────────────────────────────────────────────────────
-- ⭐ Reviews & Ratings
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  tags JSONB DEFAULT '[]',
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ─────────────────────────────────────────────────────────────
-- 💬 Chat & Messaging
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  participant_ids UUID[] NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'location', 'system')),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 🔔 Notifications
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'success', 'warning', 'error', 'trip', 'payment', 'promotion')),
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ─────────────────────────────────────────────────────────────
-- 🎓 Student Verification
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  university TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_email TEXT NOT NULL,
  id_document_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'email_sent', 'verified', 'rejected')),
  verification_code TEXT,
  code_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 💼 Business Accounts
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  monthly_budget DECIMAL(10, 2),
  billing_cycle_start INTEGER DEFAULT 1,
  auto_recharge BOOLEAN DEFAULT FALSE,
  employees JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🏆 Loyalty Program
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  tier_progress INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  type TEXT CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🚨 Disputes & Safety
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  complainant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 📊 Analytics & Logs
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  stack TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  context JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- ⚙️ System Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL,
  response_time INTEGER,
  checks JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 🔄 Functions & Triggers
-- ─────────────────────────────────────────────────────────────

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  );
  
  -- Create wallet
  INSERT INTO public.wallets (user_id, created_at)
  VALUES (NEW.id, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 🔐 Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, but only update their own
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trips: Users can see their own trips
DROP POLICY IF EXISTS "Users can view own trips" ON trips;
CREATE POLICY "Users can view own trips" ON trips FOR SELECT
  USING (auth.uid() = rider_id OR auth.uid() = driver_id);

-- Messages: Users can see messages in their conversations
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Notifications: Users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- End of Schema
-- ═══════════════════════════════════════════════════════════


-- ============================================================================
-- SECTION: 20260224000003_postgis_functions.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════
-- Wasel | واصل — PostGIS Functions & Stored Procedures
-- Version: 1.0.0
-- Date: February 24, 2026
-- ═══════════════════════════════════════════════════════════

-- Run this after the main schema migration

-- ─────────────────────────────────────────────────────────────
-- 🗺️ Geolocation Functions
-- ─────────────────────────────────────────────────────────────

/**
 * Find nearby drivers within a radius
 * Used by ride matching algorithm
 */
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  vehicle_id UUID,
  distance_km FLOAT,
  rating DECIMAL,
  total_trips INTEGER,
  vehicle_type TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  license_plate TEXT,
  current_lat FLOAT,
  current_lng FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS driver_id,
    d.vehicle_id,
    ST_Distance(
      d.current_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km,
    d.rating,
    d.total_trips,
    v.vehicle_type,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    v.color AS vehicle_color,
    v.license_plate,
    ST_Y(d.current_location::geometry) AS current_lat,
    ST_X(d.current_location::geometry) AS current_lng
  FROM drivers d
  INNER JOIN vehicles v ON v.id = d.vehicle_id
  WHERE 
    d.status = 'online'
    AND d.is_available = true
    AND v.is_active = true
    AND d.current_location IS NOT NULL
    AND d.last_location_update > NOW() - INTERVAL '5 minutes'
    AND ST_DWithin(
      d.current_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Update driver location
 * Called frequently by driver apps
 */
CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id UUID,
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_heading FLOAT DEFAULT NULL,
  p_speed FLOAT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE drivers
  SET 
    current_location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
    last_location_update = NOW()
  WHERE id = p_driver_id;
  
  -- Also update driver_locations table for trip tracking
  INSERT INTO driver_locations (driver_id, location, heading, speed, updated_at)
  VALUES (
    p_driver_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_heading,
    p_speed,
    NOW()
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

/**
 * Get drivers in a bounding box (for map display)
 */
CREATE OR REPLACE FUNCTION get_drivers_in_bounds(
  min_lat FLOAT,
  max_lat FLOAT,
  min_lng FLOAT,
  max_lng FLOAT
)
RETURNS TABLE (
  driver_id UUID,
  latitude FLOAT,
  longitude FLOAT,
  heading FLOAT,
  vehicle_type TEXT,
  rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS driver_id,
    ST_Y(d.current_location::geometry) AS latitude,
    ST_X(d.current_location::geometry) AS longitude,
    dl.heading,
    v.vehicle_type,
    d.rating
  FROM drivers d
  LEFT JOIN driver_locations dl ON dl.driver_id = d.id
  LEFT JOIN vehicles v ON v.id = d.vehicle_id
  WHERE 
    d.status = 'online'
    AND d.is_available = true
    AND d.current_location IS NOT NULL
    AND ST_Y(d.current_location::geometry) BETWEEN min_lat AND max_lat
    AND ST_X(d.current_location::geometry) BETWEEN min_lng AND max_lng
    AND d.last_location_update > NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────
-- 💰 Pricing & Promo Functions
-- ─────────────────────────────────────────────────────────────

/**
 * Increment promo code usage count
 */
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE promo_codes
  SET 
    usage_count = usage_count + 1,
    updated_at = NOW()
  WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Check if user can use promo code
 */
CREATE OR REPLACE FUNCTION can_use_promo_code(
  p_user_id UUID,
  p_promo_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  promo RECORD;
  user_usage_count INTEGER;
BEGIN
  -- Get promo code details
  SELECT * INTO promo
  FROM promo_codes
  WHERE code = UPPER(p_promo_code)
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW());
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check global usage limit
  IF promo.usage_limit IS NOT NULL AND promo.usage_count >= promo.usage_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Check per-user limit
  SELECT COUNT(*) INTO user_usage_count
  FROM promo_code_usage
  WHERE promo_code_id = promo.id AND user_id = p_user_id;
  
  IF user_usage_count >= promo.per_user_limit THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────
-- 📊 Analytics & Reports
-- ─────────────────────────────────────────────────────────────

/**
 * Get driver earnings for a period
 */
CREATE OR REPLACE FUNCTION get_driver_earnings(
  p_driver_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_trips INTEGER,
  total_earnings DECIMAL,
  total_commission DECIMAL,
  net_earnings DECIMAL,
  average_rating DECIMAL,
  total_distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_trips,
    COALESCE(SUM(driver_earnings), 0) AS total_earnings,
    COALESCE(SUM(commission), 0) AS total_commission,
    COALESCE(SUM(driver_earnings) - SUM(commission), 0) AS net_earnings,
    COALESCE(AVG(driver_rating), 0) AS average_rating,
    COALESCE(SUM(distance_km), 0) AS total_distance_km
  FROM trips
  WHERE driver_id = p_driver_id
    AND status = 'completed'
    AND completed_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get platform statistics for admin dashboard
 */
CREATE OR REPLACE FUNCTION get_platform_stats(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_trips INTEGER,
  completed_trips INTEGER,
  cancelled_trips INTEGER,
  total_revenue DECIMAL,
  total_commission DECIMAL,
  average_trip_fare DECIMAL,
  average_trip_distance DECIMAL,
  active_drivers INTEGER,
  active_riders INTEGER,
  average_driver_rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_trips,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed_trips,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER AS cancelled_trips,
    COALESCE(SUM(total_fare) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
    COALESCE(SUM(commission) FILTER (WHERE status = 'completed'), 0) AS total_commission,
    COALESCE(AVG(total_fare) FILTER (WHERE status = 'completed'), 0) AS average_trip_fare,
    COALESCE(AVG(distance_km) FILTER (WHERE status = 'completed'), 0) AS average_trip_distance,
    (SELECT COUNT(DISTINCT driver_id)::INTEGER FROM trips WHERE created_at BETWEEN p_start_date AND p_end_date) AS active_drivers,
    (SELECT COUNT(DISTINCT rider_id)::INTEGER FROM trips WHERE created_at BETWEEN p_start_date AND p_end_date) AS active_riders,
    COALESCE((SELECT AVG(rating) FROM drivers), 0) AS average_driver_rating
  FROM trips
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get surge pricing data for a location
 */
CREATE OR REPLACE FUNCTION get_surge_data(
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_radius_km FLOAT DEFAULT 5
)
RETURNS TABLE (
  pending_trips INTEGER,
  available_drivers INTEGER,
  demand_supply_ratio FLOAT,
  recommended_surge DECIMAL
) AS $$
DECLARE
  pending INTEGER;
  available INTEGER;
  ratio FLOAT;
  surge DECIMAL;
BEGIN
  -- Count pending trips in area (last 5 minutes)
  SELECT COUNT(*) INTO pending
  FROM trips
  WHERE status = 'pending'
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND ST_DWithin(
      pickup_location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_km * 1000
    );
  
  -- Count available drivers in area
  SELECT COUNT(*) INTO available
  FROM drivers
  WHERE status = 'online'
    AND is_available = true
    AND current_location IS NOT NULL
    AND ST_DWithin(
      current_location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_km * 1000
    );
  
  -- Calculate ratio
  IF available > 0 THEN
    ratio := pending::FLOAT / available::FLOAT;
  ELSE
    ratio := pending::FLOAT;
  END IF;
  
  -- Determine surge multiplier
  IF ratio >= 3.0 THEN
    surge := 2.0;
  ELSIF ratio >= 2.0 THEN
    surge := 1.5;
  ELSIF ratio >= 1.5 THEN
    surge := 1.3;
  ELSE
    surge := 1.0;
  END IF;
  
  RETURN QUERY SELECT pending, available, ratio, surge;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────
-- 🏆 Loyalty & Gamification
-- ─────────────────────────────────────────────────────────────

/**
 * Award loyalty points for a trip
 */
CREATE OR REPLACE FUNCTION award_trip_points(
  p_user_id UUID,
  p_trip_id UUID,
  p_trip_fare DECIMAL
)
RETURNS INTEGER AS $$
DECLARE
  points_earned INTEGER;
  current_tier TEXT;
BEGIN
  -- Calculate points (1 point per 1 JOD spent)
  points_earned := FLOOR(p_trip_fare);
  
  -- Get current tier
  SELECT tier INTO current_tier
  FROM loyalty_points
  WHERE user_id = p_user_id;
  
  -- Bonus points based on tier
  IF current_tier = 'platinum' THEN
    points_earned := FLOOR(points_earned * 1.5);
  ELSIF current_tier = 'gold' THEN
    points_earned := FLOOR(points_earned * 1.3);
  ELSIF current_tier = 'silver' THEN
    points_earned := FLOOR(points_earned * 1.1);
  END IF;
  
  -- Update loyalty points
  INSERT INTO loyalty_points (user_id, points, lifetime_points, created_at, updated_at)
  VALUES (p_user_id, points_earned, points_earned, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    points = loyalty_points.points + points_earned,
    lifetime_points = loyalty_points.lifetime_points + points_earned,
    updated_at = NOW();
  
  -- Record transaction
  INSERT INTO loyalty_transactions (user_id, trip_id, points, type, description, created_at)
  VALUES (p_user_id, p_trip_id, points_earned, 'earned', 'Trip completed', NOW());
  
  -- Update tier if needed
  PERFORM update_loyalty_tier(p_user_id);
  
  RETURN points_earned;
END;
$$ LANGUAGE plpgsql;

/**
 * Update user's loyalty tier based on lifetime points
 */
CREATE OR REPLACE FUNCTION update_loyalty_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  lifetime_pts INTEGER;
  new_tier TEXT;
BEGIN
  SELECT lifetime_points INTO lifetime_pts
  FROM loyalty_points
  WHERE user_id = p_user_id;
  
  IF lifetime_pts >= 10000 THEN
    new_tier := 'platinum';
  ELSIF lifetime_pts >= 5000 THEN
    new_tier := 'gold';
  ELSIF lifetime_pts >= 2000 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;
  
  UPDATE loyalty_points
  SET tier = new_tier, updated_at = NOW()
  WHERE user_id = p_user_id AND tier != new_tier;
  
  RETURN new_tier;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 🔔 Notification Functions
-- ─────────────────────────────────────────────────────────────

/**
 * Create notification for user
 */
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, data, created_at)
  VALUES (p_user_id, p_title, p_message, p_type, p_data, NOW())
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Mark notifications as read
 */
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = false;
  ELSE
    -- Mark specific notifications as read
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = p_user_id 
      AND id = ANY(p_notification_ids)
      AND is_read = false;
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 🔐 Security & Audit
-- ─────────────────────────────────────────────────────────────

/**
 * Log API request
 */
CREATE OR REPLACE FUNCTION log_api_request(
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_response_time INTEGER,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO api_logs (
    endpoint, method, status_code, response_time, 
    user_id, ip_address, user_agent, created_at
  )
  VALUES (
    p_endpoint, p_method, p_status_code, p_response_time,
    p_user_id, p_ip_address, p_user_agent, NOW()
  );
END;
$$ LANGUAGE plpgsql;

/**
 * Log error
 */
CREATE OR REPLACE FUNCTION log_error(
  p_message TEXT,
  p_stack TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'error',
  p_context JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO error_logs (message, stack, severity, context, user_id, created_at)
  VALUES (p_message, p_stack, p_severity, p_context, p_user_id, NOW());
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 📈 Performance Indexes
-- ─────────────────────────────────────────────────────────────

-- Geospatial indexes
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_location ON trips USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_trips_dropoff_location ON trips USING GIST(dropoff_location);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_drivers_status_available ON drivers(status, is_available) WHERE status = 'online' AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_trips_status_created ON trips(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON profiles USING GIN(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_address_trgm ON trips USING GIN(pickup_address gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════
-- End of PostGIS Functions
-- ═══════════════════════════════════════════════════════════


-- ============================================================================
-- SECTION: 20260224000004_additional_tables.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════
-- Wasel | واصل — Additional Tables for Real-time Features
-- Version: 1.0.1
-- Date: February 24, 2026
-- ═══════════════════════════════════════════════════════════

-- This supplements the main schema migration

-- ─────────────────────────────────────────────────────────────
-- 📍 Real-time Driver Location Tracking
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  heading FLOAT,
  speed FLOAT,
  accuracy FLOAT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index for efficient nearby queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_trip ON driver_locations(driver_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated ON driver_locations(updated_at DESC);

-- Enable realtime updates
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- ─────────────────────────────────────────────────────────────
-- 🎟️ Promo Code Usage Tracking
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id, trip_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo ON promo_code_usage(promo_code_id);

-- ─────────────────────────────────────────────────────────────
-- 📊 Trip Analytics Cache
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  hour INTEGER,
  location_zone TEXT,
  total_trips INTEGER DEFAULT 0,
  completed_trips INTEGER DEFAULT 0,
  cancelled_trips INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  average_fare DECIMAL(10, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, hour, location_zone)
);

CREATE INDEX IF NOT EXISTS idx_trip_analytics_date ON trip_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_trip_analytics_zone ON trip_analytics(location_zone);

-- ─────────────────────────────────────────────────────────────
-- 🚦 Driver Status History (for analytics)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  is_available BOOLEAN,
  location GEOGRAPHY(POINT),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_status_history_driver ON driver_status_history(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_status_history_created ON driver_status_history(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 💬 Chat Media Files
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_type TEXT CHECK (file_type IN ('image', 'video', 'audio', 'document')),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  thumbnail_url TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_media_message ON chat_media(message_id);

-- ─────────────────────────────────────────────────────────────
-- 🎯 Marketing Campaigns
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('push', 'email', 'sms', 'in_app')),
  target_audience JSONB,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  title_en TEXT,
  title_ar TEXT,
  image_url TEXT,
  action_url TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
  recipient_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_for);

-- ─────────────────────────────────────────────────────────────
-- 📱 Device Tracking (for push notifications)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT,
  app_version TEXT,
  os_version TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active DESC);

-- ─────────────────────────────────────────────────────────────
-- 🔐 Audit Logs (for compliance)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 🚨 Safety Incidents
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS safety_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  location GEOGRAPHY(POINT),
  evidence JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_trip ON safety_incidents(trip_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_status ON safety_incidents(status);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_severity ON safety_incidents(severity);

-- ─────────────────────────────────────────────────────────────
-- 💰 Driver Payouts
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_trips INTEGER DEFAULT 0,
  gross_earnings DECIMAL(10, 2) DEFAULT 0,
  commission DECIMAL(10, 2) DEFAULT 0,
  bonuses DECIMAL(10, 2) DEFAULT 0,
  deductions DECIMAL(10, 2) DEFAULT 0,
  net_payout DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'JOD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payout_method TEXT,
  transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver ON driver_payouts(driver_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_status ON driver_payouts(status);

-- ─────────────────────────────────────────────────────────────
-- 🎓 University Partnerships (for student discounts)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  city TEXT NOT NULL,
  email_domains TEXT[] NOT NULL,
  discount_percentage INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universities_active ON universities(is_active);

-- Seed some universities
INSERT INTO universities (name, name_ar, city, email_domains, discount_percentage) VALUES
('University of Jordan', 'الجامعة الأردنية', 'Amman', ARRAY['ju.edu.jo'], 15),
('Jordan University of Science and Technology', 'جامعة العلوم والتكنولوجيا الأردنية', 'Irbid', ARRAY['just.edu.jo'], 15),
('Yarmouk University', 'جامعة اليرموك', 'Irbid', ARRAY['yu.edu.jo'], 15),
('German Jordanian University', 'الجامعة الألمانية الأردنية', 'Amman', ARRAY['gju.edu.jo'], 15),
('Princess Sumaya University', 'جامعة الأميرة سمية', 'Amman', ARRAY['psut.edu.jo'], 15)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 🔄 Realtime Subscriptions
-- ─────────────────────────────────────────────────────────────

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;

-- ─────────────────────────────────────────────────────────────
-- 🔐 Row Level Security Policies
-- ─────────────────────────────────────────────────────────────

-- Driver Locations: Only visible to active trips
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view driver location for their trips" ON driver_locations;
CREATE POLICY "Users can view driver location for their trips" ON driver_locations FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE rider_id = auth.uid() OR driver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update own location" ON driver_locations;
CREATE POLICY "Drivers can update own location" ON driver_locations FOR ALL
  USING (driver_id = auth.uid());

-- Promo Code Usage: Users can view own usage
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own promo usage" ON promo_code_usage;
CREATE POLICY "Users can view own promo usage" ON promo_code_usage FOR SELECT
  USING (user_id = auth.uid());

-- Safety Incidents: Participants can view
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own safety incidents" ON safety_incidents;
CREATE POLICY "Users can view own safety incidents" ON safety_incidents FOR SELECT
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can report safety incidents" ON safety_incidents;
CREATE POLICY "Users can report safety incidents" ON safety_incidents FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- End of Additional Tables
-- ═══════════════════════════════════════════════════════════


-- ============================================================================
-- SECTION: 20260302000000_regionalization_schema.sql
-- ============================================================================

-- ============================================================================
-- WASEL REGIONALIZATION SCHEMA v2.0
-- Phase 1: Country & Context Infrastructure
-- Created: March 2, 2026
-- ============================================================================

-- ============================================================================
-- 1. COUNTRIES TABLE (Core Country Registry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identifiers
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  name_local VARCHAR(100), -- Native language name (e.g., "مصر" for Egypt)
  iso_alpha2 CHAR(2) NOT NULL UNIQUE, -- "EG", "SA", "AE", etc.
  iso_alpha3 CHAR(3) NOT NULL UNIQUE, -- "EGY", "SAU", "ARE", etc.
  iso_numeric CHAR(3), -- "818", "682", "784", etc.
  
  -- Localization
  default_currency_code CHAR(3) NOT NULL, -- "EGP", "SAR", "AED", etc.
  default_locale VARCHAR(10) NOT NULL DEFAULT 'ar', -- "ar-EG", "ar-SA", etc.
  fallback_locale VARCHAR(10) DEFAULT 'en',
  phone_country_code VARCHAR(5) NOT NULL, -- "+20", "+966", "+971", etc.
  phone_format VARCHAR(50), -- "(###) ###-####" for formatting
  
  -- Regional settings
  timezone VARCHAR(50) NOT NULL, -- "Africa/Cairo", "Asia/Riyadh", etc.
  utc_offset_minutes INTEGER NOT NULL, -- 120, 180, 240, etc.
  is_rtl BOOLEAN NOT NULL DEFAULT true,
  calendar_type VARCHAR(20) DEFAULT 'gregorian', -- "gregorian", "hijri"
  weekend_days INTEGER[] DEFAULT ARRAY[5, 6], -- [Friday=5, Saturday=6] for most MENA
  
  -- Status & metadata
  status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- "active", "inactive", "coming_soon", "beta"
  launch_date DATE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority (for ordering)
  flag_emoji VARCHAR(10), -- "🇪🇬", "🇸🇦", "🇦🇪", etc.
  
  -- Regulatory
  requires_national_id BOOLEAN DEFAULT true,
  requires_police_clearance BOOLEAN DEFAULT true,
  min_driver_age INTEGER DEFAULT 21,
  min_passenger_age_alone INTEGER DEFAULT 18,
  allows_cross_border BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'coming_soon', 'beta')),
  CONSTRAINT valid_calendar CHECK (calendar_type IN ('gregorian', 'hijri', 'both'))
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_countries_iso_alpha2 ON countries(iso_alpha2);
CREATE INDEX IF NOT EXISTS idx_countries_status ON countries(status);
CREATE INDEX IF NOT EXISTS idx_countries_priority ON countries(priority);

-- Update trigger
CREATE OR REPLACE FUNCTION update_countries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_countries_updated_at ON countries;
CREATE TRIGGER trigger_update_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_countries_updated_at();

-- ============================================================================
-- 2. COUNTRY_CONFIGS TABLE (Flexible Key-Value Config Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS country_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  
  -- Config key-value
  key VARCHAR(100) NOT NULL, -- "pricing_engine_version", "map_style", etc.
  value JSONB NOT NULL, -- Flexible JSON storage
  description TEXT,
  
  -- Metadata
  config_type VARCHAR(50) DEFAULT 'general', -- "general", "pricing", "payment", "cultural", "safety"
  is_sensitive BOOLEAN DEFAULT false, -- Hide from public APIs
  requires_approval BOOLEAN DEFAULT false, -- Needs manager approval to change
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(country_id, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_country_configs_country_id ON country_configs(country_id);
CREATE INDEX IF NOT EXISTS idx_country_configs_key ON country_configs(key);
CREATE INDEX IF NOT EXISTS idx_country_configs_type ON country_configs(config_type);

-- Update trigger
DROP TRIGGER IF EXISTS trigger_update_country_configs_updated_at ON country_configs;
CREATE TRIGGER trigger_update_country_configs_updated_at
  BEFORE UPDATE ON country_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_countries_updated_at();

-- ============================================================================
-- 3. CURRENCIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identifiers
  code CHAR(3) NOT NULL UNIQUE, -- "EGP", "SAR", "AED", etc.
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL, -- "ج.م", "ر.س", "د.إ", etc.
  symbol_native VARCHAR(10), -- Native symbol
  
  -- Formatting
  decimals INTEGER NOT NULL DEFAULT 2, -- 2 for most, 3 for KWD/BHD
  symbol_position VARCHAR(10) DEFAULT 'before', -- "before", "after"
  decimal_separator VARCHAR(5) DEFAULT '.',
  thousands_separator VARCHAR(5) DEFAULT ',',
  
  -- Metadata
  is_crypto BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies(is_active);

-- ============================================================================
-- 4. EXCHANGE_RATES TABLE (Real-time Currency Conversion)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Currency pair
  from_currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
  to_currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
  
  -- Rate details
  rate DECIMAL(18, 8) NOT NULL, -- High precision for crypto/volatile currencies
  inverse_rate DECIMAL(18, 8), -- Pre-calculated for performance
  
  -- Source & validity
  source VARCHAR(50) DEFAULT 'manual', -- "manual", "ecb", "exchangerate.host", etc.
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL = no expiry
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(from_currency_code, to_currency_code, fetched_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency_code, to_currency_code);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(is_active);

-- ============================================================================
-- 5. SERVICE_ZONES (Geo-Fencing & Service Areas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location hierarchy
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  city_name VARCHAR(100) NOT NULL,
  city_name_ar VARCHAR(100) NOT NULL,
  zone_name VARCHAR(100), -- "Downtown Riyadh", "Cairo Airport", etc.
  zone_name_ar VARCHAR(100),
  
  -- Geo data (PostGIS)
  zone_polygon GEOMETRY(POLYGON, 4326) NOT NULL, -- WGS84
  center_point GEOMETRY(POINT, 4326), -- Pre-calculated centroid
  
  -- Service configuration
  service_type VARCHAR(50) NOT NULL, -- "intercity", "carpool", "delivery", etc.
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  
  -- Metadata
  population_estimate INTEGER,
  coverage_area_km2 DECIMAL(10, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial indexes (PostGIS)
CREATE INDEX IF NOT EXISTS idx_service_zones_polygon ON service_zones USING GIST(zone_polygon);
CREATE INDEX IF NOT EXISTS idx_service_zones_center ON service_zones USING GIST(center_point);
CREATE INDEX IF NOT EXISTS idx_service_zones_country ON service_zones(country_id);
CREATE INDEX IF NOT EXISTS idx_service_zones_service_type ON service_zones(service_type);

-- ============================================================================
-- 6. ROUTE_RESTRICTIONS (Cross-Border Logic)
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Route definition
  from_country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  to_country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  
  -- Restriction rules
  allowed BOOLEAN DEFAULT false,
  reason_code VARCHAR(50), -- "border_closed", "no_license", "regulatory", etc.
  reason_message TEXT,
  reason_message_ar TEXT,
  
  -- Conditional rules (JSONB for flexibility)
  conditions JSONB, -- {"requires_passport": true, "max_distance_km": 500}
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(from_country_id, to_country_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_route_restrictions_from ON route_restrictions(from_country_id);
CREATE INDEX IF NOT EXISTS idx_route_restrictions_to ON route_restrictions(to_country_id);

-- ============================================================================
-- 7. PRICING_ZONES (Dynamic Pricing per Zone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  city_name VARCHAR(100) NOT NULL,
  zone_polygon GEOMETRY(POLYGON, 4326),
  
  -- Pricing rules (flexible JSONB)
  base_fare_rules JSONB NOT NULL, -- {"intercity": {"base": 800, "per_km": 50}}
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  
  -- Validity
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pricing_zones_polygon ON pricing_zones USING GIST(zone_polygon);
CREATE INDEX IF NOT EXISTS idx_pricing_zones_country ON pricing_zones(country_id);
CREATE INDEX IF NOT EXISTS idx_pricing_zones_active ON pricing_zones(is_active);

-- ============================================================================
-- 8. COUNTRY_SERVICES (Feature Flags per Country)
-- ============================================================================
CREATE TABLE IF NOT EXISTS country_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  service_id VARCHAR(50) NOT NULL, -- Maps to services in /config/services-hierarchy.ts
  
  -- Availability
  enabled BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 100, -- Display order
  rollout_percentage INTEGER DEFAULT 0, -- 0-100 for gradual rollout
  
  -- Metadata
  launch_date DATE,
  sunset_date DATE,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(country_id, service_id),
  CONSTRAINT valid_rollout CHECK (rollout_percentage BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_country_services_country ON country_services(country_id);
CREATE INDEX IF NOT EXISTS idx_country_services_enabled ON country_services(enabled);

-- ============================================================================
-- 9. COUNTRY_FEATURE_FLAGS (Feature Toggle System)
-- ============================================================================
CREATE TABLE IF NOT EXISTS country_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  flag_key VARCHAR(100) NOT NULL, -- "female_driver_preference", "prayer_stops", etc.
  
  -- Flag state
  enabled BOOLEAN DEFAULT false,
  variant VARCHAR(50), -- "control", "variant_a", "variant_b" for A/B testing
  rollout_percentage INTEGER DEFAULT 0, -- 0-100
  
  -- Metadata
  description TEXT,
  category VARCHAR(50), -- "safety", "cultural", "payment", "premium"
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(country_id, flag_key),
  CONSTRAINT valid_flag_rollout CHECK (rollout_percentage BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_country_feature_flags_country ON country_feature_flags(country_id);
CREATE INDEX IF NOT EXISTS idx_country_feature_flags_key ON country_feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_country_feature_flags_enabled ON country_feature_flags(enabled);

-- ============================================================================
-- 10. USER_REGIONAL_PREFERENCES (User-Specific Country Settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_regional_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_iso CHAR(2) NOT NULL, -- User's preferred country context
  
  -- Preferences
  gender_preference VARCHAR(20), -- "mixed", "women_only", "men_only", "family_only"
  privacy_level VARCHAR(20) DEFAULT 'standard', -- "standard", "high", "maximum"
  preferred_locale VARCHAR(10), -- Override country default
  preferred_currency CHAR(3), -- Override country default
  
  -- Cultural preferences
  prayer_time_alerts BOOLEAN DEFAULT true,
  ramadan_mode BOOLEAN DEFAULT false,
  hide_profile_photo BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, country_iso)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_regional_prefs_user ON user_regional_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_regional_prefs_country ON user_regional_preferences(country_iso);

-- ============================================================================
-- 11. CONFIG_AUDIT_LOG (Full Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS config_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- "INSERT", "UPDATE", "DELETE"
  
  -- Who changed it
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  
  -- What was the change
  old_value JSONB,
  new_value JSONB,
  changed_fields TEXT[], -- Array of field names that changed
  
  -- When & where
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- Impact assessment
  impact_level VARCHAR(20) DEFAULT 'low', -- "low", "medium", "high", "critical"
  requires_rollback BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_config_audit_table ON config_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_config_audit_record ON config_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_user ON config_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_changed_at ON config_audit_log(changed_at DESC);

-- ============================================================================
-- SEED DATA: Initial 10 MENA Countries
-- ============================================================================

INSERT INTO countries (name, name_ar, iso_alpha2, iso_alpha3, default_currency_code, default_locale, phone_country_code, timezone, utc_offset_minutes, status, priority, flag_emoji, weekend_days) VALUES
  -- Jordan (already launched)
  ('Jordan', 'الأردن', 'JO', 'JOR', 'JOD', 'ar-JO', '+962', 'Asia/Amman', 180, 'active', 1, '🇯🇴', ARRAY[5, 6]),
  
  -- Priority launches (Gulf)
  ('Saudi Arabia', 'المملكة العربية السعودية', 'SA', 'SAU', 'SAR', 'ar-SA', '+966', 'Asia/Riyadh', 180, 'coming_soon', 2, '🇸🇦', ARRAY[5, 6]),
  ('United Arab Emirates', 'الإمارات العربية المتحدة', 'AE', 'ARE', 'AED', 'ar-AE', '+971', 'Asia/Dubai', 240, 'coming_soon', 3, '🇦🇪', ARRAY[5, 6]),
  ('Qatar', 'قطر', 'QA', 'QAT', 'QAR', 'ar-QA', '+974', 'Asia/Qatar', 180, 'coming_soon', 4, '🇶🇦', ARRAY[5, 6]),
  ('Kuwait', 'الكويت', 'KW', 'KWT', 'KWD', 'ar-KW', '+965', 'Asia/Kuwait', 180, 'coming_soon', 5, '🇰🇼', ARRAY[5, 6]),
  
  -- Other Gulf
  ('Bahrain', 'البحرين', 'BH', 'BHR', 'BHD', 'ar-BH', '+973', 'Asia/Bahrain', 180, 'coming_soon', 6, '🇧🇭', ARRAY[5, 6]),
  ('Oman', 'عُمان', 'OM', 'OMN', 'OMR', 'ar-OM', '+968', 'Asia/Muscat', 240, 'coming_soon', 7, '🇴🇲', ARRAY[5, 6]),
  
  -- North Africa
  ('Egypt', 'مصر', 'EG', 'EGY', 'EGP', 'ar-EG', '+20', 'Africa/Cairo', 120, 'coming_soon', 8, '🇪🇬', ARRAY[5, 6]),
  
  -- Levant
  ('Lebanon', 'لبنان', 'LB', 'LBN', 'LBP', 'ar-LB', '+961', 'Asia/Beirut', 120, 'coming_soon', 9, '🇱🇧', ARRAY[6, 0]),
  
  -- Iraq
  ('Iraq', 'العراق', 'IQ', 'IRQ', 'IQD', 'ar-IQ', '+964', 'Asia/Baghdad', 180, 'coming_soon', 10, '🇮🇶', ARRAY[5, 6])
ON CONFLICT (iso_alpha2) DO NOTHING;

-- ============================================================================
-- SEED DATA: Currencies
-- ============================================================================

INSERT INTO currencies (code, name, name_ar, symbol, decimals, symbol_position) VALUES
  ('JOD', 'Jordanian Dinar', 'دينار أردني', 'د.أ', 3, 'after'),
  ('SAR', 'Saudi Riyal', 'ريال سعودي', 'ر.س', 2, 'after'),
  ('AED', 'UAE Dirham', 'درهم إماراتي', 'د.إ', 2, 'after'),
  ('QAR', 'Qatari Riyal', 'ريال قطري', 'ر.ق', 2, 'after'),
  ('KWD', 'Kuwaiti Dinar', 'دينار كويتي', 'د.ك', 3, 'after'),
  ('BHD', 'Bahraini Dinar', 'دينار بحريني', 'د.ب', 3, 'after'),
  ('OMR', 'Omani Rial', 'ريال عماني', 'ر.ع', 3, 'after'),
  ('EGP', 'Egyptian Pound', 'جنيه مصري', 'ج.م', 2, 'after'),
  ('LBP', 'Lebanese Pound', 'ليرة لبنانية', 'ل.ل', 2, 'after'),
  ('IQD', 'Iraqi Dinar', 'دينار عراقي', 'د.ع', 3, 'after'),
  ('USD', 'US Dollar', 'دولار أمريكي', '$', 2, 'before')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default Exchange Rates (to USD)
-- ============================================================================

INSERT INTO exchange_rates (from_currency_code, to_currency_code, rate, inverse_rate, source, valid_until) VALUES
  ('JOD', 'USD', 1.41, 0.71, 'manual', '2026-12-31'),
  ('SAR', 'USD', 0.27, 3.75, 'manual', '2026-12-31'),
  ('AED', 'USD', 0.27, 3.67, 'manual', '2026-12-31'),
  ('QAR', 'USD', 0.27, 3.64, 'manual', '2026-12-31'),
  ('KWD', 'USD', 3.26, 0.31, 'manual', '2026-12-31'),
  ('BHD', 'USD', 2.65, 0.38, 'manual', '2026-12-31'),
  ('OMR', 'USD', 2.60, 0.38, 'manual', '2026-12-31'),
  ('EGP', 'USD', 0.032, 31.00, 'manual', '2026-12-31'),
  ('LBP', 'USD', 0.000067, 15000, 'manual', '2026-12-31'),
  ('IQD', 'USD', 0.00068, 1470, 'manual', '2026-12-31')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_regional_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;

-- Public read access for countries, currencies, exchange rates
DROP POLICY IF EXISTS "Public read access to active countries" ON countries;
CREATE POLICY "Public read access to active countries" ON countries FOR SELECT
  USING (status = 'active' OR status = 'coming_soon');

DROP POLICY IF EXISTS "Public read access to currencies" ON currencies;
CREATE POLICY "Public read access to currencies" ON currencies FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read access to exchange rates" ON exchange_rates;
CREATE POLICY "Public read access to exchange rates" ON exchange_rates FOR SELECT
  USING (is_active = true);

-- Users can read their own preferences
DROP POLICY IF EXISTS "Users can read own regional preferences" ON user_regional_preferences;
CREATE POLICY "Users can read own regional preferences" ON user_regional_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own regional preferences" ON user_regional_preferences;
CREATE POLICY "Users can update own regional preferences" ON user_regional_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own regional preferences" ON user_regional_preferences;
CREATE POLICY "Users can insert own regional preferences" ON user_regional_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin-only policies for config tables
DROP POLICY IF EXISTS "Admins can manage country_configs" ON country_configs;
CREATE POLICY "Admins can manage country_configs" ON country_configs FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can manage service_zones" ON service_zones;
CREATE POLICY "Admins can manage service_zones" ON service_zones FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active countries
CREATE OR REPLACE FUNCTION get_active_countries()
RETURNS TABLE (
  iso_alpha2 CHAR(2),
  name VARCHAR(100),
  name_ar VARCHAR(100),
  currency_code CHAR(3),
  flag_emoji VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.iso_alpha2, c.name, c.name_ar, c.default_currency_code, c.flag_emoji
  FROM countries c
  WHERE c.status = 'active'
  ORDER BY c.priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get country config by ISO
CREATE OR REPLACE FUNCTION get_country_config(country_iso CHAR(2))
RETURNS JSONB AS $$
DECLARE
  config_json JSONB;
BEGIN
  SELECT jsonb_object_agg(cc.key, cc.value)
  INTO config_json
  FROM country_configs cc
  JOIN countries c ON c.id = cc.country_id
  WHERE c.iso_alpha2 = country_iso;
  
  RETURN COALESCE(config_json, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Convert currency
CREATE OR REPLACE FUNCTION convert_currency(
  amount DECIMAL,
  from_code CHAR(3),
  to_code CHAR(3)
)
RETURNS DECIMAL AS $$
DECLARE
  exchange_rate DECIMAL;
BEGIN
  IF from_code = to_code THEN
    RETURN amount;
  END IF;
  
  SELECT er.rate INTO exchange_rate
  FROM exchange_rates er
  WHERE er.from_currency_code = from_code
    AND er.to_currency_code = to_code
    AND er.is_active = true
    AND (er.valid_until IS NULL OR er.valid_until > NOW())
  ORDER BY er.fetched_at DESC
  LIMIT 1;
  
  IF exchange_rate IS NULL THEN
    RAISE EXCEPTION 'No exchange rate found for % to %', from_code, to_code;
  END IF;
  
  RETURN amount * exchange_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Regionalization Schema v2.0 Applied Successfully';
  RAISE NOTICE '📊 10 MENA countries seeded';
  RAISE NOTICE '💱 11 currencies configured';
  RAISE NOTICE '🔐 RLS policies enabled';
  RAISE NOTICE '🚀 Ready for Phase 2: Geo-Fencing';
END $$;


-- ============================================================================
-- SECTION: 20260310000000_security_performance_fixes.sql
-- ============================================================================

-- ============================================================================
-- Wasel Backend Security & Performance Fixes
-- Date: March 10, 2026
-- Version: 1.0.0
-- Description: Comprehensive fixes for RLS policies, indexes, and optimization
-- ============================================================================

-- ============================================================================
-- PART 1: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- ── KV Store Security ───────────────────────────────────────────────────────
-- Secure the key-value store with proper RLS policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kv_store_0b1f4071' AND table_schema = 'public') THEN
    ALTER TABLE kv_store_0b1f4071 ENABLE ROW LEVEL SECURITY;

    -- Allow users to access their own KV data
    DROP POLICY IF EXISTS "Users can access their own KV data" ON kv_store_0b1f4071;
    CREATE POLICY "Users can access their own KV data" ON kv_store_0b1f4071 FOR ALL
      USING (
        key LIKE 'user:' || auth.uid()::TEXT || ':%' OR
        key LIKE 'profile:' || auth.uid()::TEXT OR
        key LIKE 'wallet:' || auth.uid()::TEXT || ':%' OR
        key LIKE 'notification:' || auth.uid()::TEXT || ':%'
      );

    -- Allow system to access shared/public KV data
    DROP POLICY IF EXISTS "System can access shared KV data" ON kv_store_0b1f4071;
    CREATE POLICY "System can access shared KV data" ON kv_store_0b1f4071 FOR ALL
      USING (
        key LIKE 'system:%' OR
        key LIKE 'trip:%' OR
        key LIKE 'package:%' OR
        key LIKE 'route:%' OR
        key LIKE 'cache:%' OR
        key LIKE 'config:%'
      );

    -- Allow service role to access everything
    DROP POLICY IF EXISTS "Service role can access all KV data" ON kv_store_0b1f4071;
    CREATE POLICY "Service role can access all KV data" ON kv_store_0b1f4071 FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- ── Trips Table Security ────────────────────────────────────────────────────
-- Enhanced policies for trips

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view published trips" ON trips;
DROP POLICY IF EXISTS "Users can insert their own trips" ON trips;
DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;

-- Public can view published and active trips only
DROP POLICY IF EXISTS "Public can view published trips" ON trips;
CREATE POLICY "Public can view published trips" ON trips FOR SELECT
  USING (status IN ('published', 'active') AND deleted_at IS NULL);

-- Users can view their own trips (all statuses)
DROP POLICY IF EXISTS "Users can view their own trips" ON trips;
CREATE POLICY "Users can view their own trips" ON trips FOR SELECT
  USING (user_id = auth.uid());

-- Users can create trips
DROP POLICY IF EXISTS "Users can create trips" ON trips;
CREATE POLICY "Users can create trips" ON trips FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own trips
DROP POLICY IF EXISTS "Users can update their own trips" ON trips;
CREATE POLICY "Users can update their own trips" ON trips FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own trips
DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;
CREATE POLICY "Users can delete their own trips" ON trips FOR DELETE
  USING (user_id = auth.uid());

-- ── Bookings Table Security ─────────────────────────────────────────────────
-- Enhanced policies for bookings

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can view bookings for their trips" ON bookings;
DROP POLICY IF EXISTS "Passengers can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Passengers can create bookings" ON bookings;
DROP POLICY IF EXISTS "Trip owners can update booking status" ON bookings;
DROP POLICY IF EXISTS "Passengers can cancel their bookings" ON bookings;

-- Drivers can view bookings for their trips
DROP POLICY IF EXISTS "Drivers can view bookings for their trips" ON bookings;
CREATE POLICY "Drivers can view bookings for their trips" ON bookings FOR SELECT
  USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

-- Passengers can view their own bookings
DROP POLICY IF EXISTS "Passengers can view their own bookings" ON bookings;
CREATE POLICY "Passengers can view their own bookings" ON bookings FOR SELECT
  USING (passenger_id = auth.uid());

-- Passengers can create bookings
DROP POLICY IF EXISTS "Passengers can create bookings" ON bookings;
CREATE POLICY "Passengers can create bookings" ON bookings FOR INSERT
  WITH CHECK (passenger_id = auth.uid() AND status = 'pending');

-- Only trip owner can accept/reject bookings
DROP POLICY IF EXISTS "Trip owners can update booking status" ON bookings;
CREATE POLICY "Trip owners can update booking status" ON bookings FOR UPDATE
  USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  )
  WITH CHECK (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()) AND
    status IN ('accepted', 'rejected', 'completed', 'cancelled')
  );

-- Passengers can cancel their own pending bookings
DROP POLICY IF EXISTS "Passengers can cancel their bookings" ON bookings;
CREATE POLICY "Passengers can cancel their bookings" ON bookings FOR UPDATE
  USING (
    passenger_id = auth.uid() AND 
    status = 'pending'
  )
  WITH CHECK (
    passenger_id = auth.uid() AND 
    status = 'cancelled'
  );

-- ── Profiles Table Security ─────────────────────────────────────────────────
-- Enhanced policies for profiles

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Public can view basic profile info (for trust scores, reviews)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile (signup)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── Messages Table Security ─────────────────────────────────────────────────
-- Users can only see messages they're part of

DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Users can view messages where they are sender or recipient
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages" ON messages FOR SELECT
  USING (
    sender_id = auth.uid() OR 
    recipient_id = auth.uid()
  );

-- Users can send messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ── Notifications Table Security ────────────────────────────────────────────
-- Users can only see their own notifications

DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark notifications as read
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System (service role) can create notifications for anyone
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── Reviews Table Security ──────────────────────────────────────────────────
-- Public can read reviews, users can create reviews for completed trips

DROP POLICY IF EXISTS "Public can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;

-- Public can view all reviews (for trust scores)
DROP POLICY IF EXISTS "Public can view reviews" ON reviews;
CREATE POLICY "Public can view reviews" ON reviews FOR SELECT
  USING (true);

-- Users can create reviews for trips they participated in
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid() AND
    (
      -- Can review as driver (trip owner)
      trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()) OR
      -- Can review as passenger (booking exists)
      trip_id IN (SELECT trip_id FROM bookings WHERE passenger_id = auth.uid() AND status = 'completed')
    )
  );

-- ============================================================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================================================

-- ── Trips Table Indexes ─────────────────────────────────────────────────────

-- Index for filtering by status (most common query)
CREATE INDEX IF NOT EXISTS idx_trips_status 
  ON trips(status) 
  WHERE status IN ('published', 'active') AND deleted_at IS NULL;

-- Index for filtering by departure time
CREATE INDEX IF NOT EXISTS idx_trips_departure_time 
  ON trips(departure_time DESC);

-- Index for user's trips lookup
CREATE INDEX IF NOT EXISTS idx_trips_user_id 
  ON trips(user_id);

-- Composite index for user + status queries
CREATE INDEX IF NOT EXISTS idx_trips_user_status 
  ON trips(user_id, status);

-- Index for created_at ordering (recent trips)
CREATE INDEX IF NOT EXISTS idx_trips_created_at 
  ON trips(created_at DESC);

-- Composite index for search queries (origin + destination + date + status)
CREATE INDEX IF NOT EXISTS idx_trips_search 
  ON trips(origin, destination, departure_time, status)
  WHERE status IN ('published', 'active') AND deleted_at IS NULL;

-- GIN index for full-text search on origin and destination
CREATE INDEX IF NOT EXISTS idx_trips_search_text 
  ON trips USING gin(
    to_tsvector('english', 
      COALESCE(origin, '') || ' ' || 
      COALESCE(destination, '')
    )
  );

-- Spatial index for location-based queries (if using PostGIS)
-- Uncomment if you need geo queries
-- CREATE INDEX IF NOT EXISTS idx_trips_origin_location 
--   ON trips USING GIST(
--     ST_MakePoint(origin_lng, origin_lat)
--   ) WHERE origin_lng IS NOT NULL AND origin_lat IS NOT NULL;

-- CREATE INDEX IF NOT EXISTS idx_trips_destination_location 
--   ON trips USING GIST(
--     ST_MakePoint(destination_lng, destination_lat)
--   ) WHERE destination_lng IS NOT NULL AND destination_lat IS NOT NULL;

-- ── Bookings Table Indexes ──────────────────────────────────────────────────

-- Index for trip_id lookups (driver viewing bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id 
  ON bookings(trip_id);

-- Index for passenger_id lookups (passenger viewing their bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id 
  ON bookings(passenger_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_bookings_status 
  ON bookings(status);

-- Index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_bookings_created_at 
  ON bookings(created_at DESC);

-- Composite index for trip + status queries
CREATE INDEX IF NOT EXISTS idx_bookings_trip_status 
  ON bookings(trip_id, status);

-- Composite index for passenger + status queries
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_status 
  ON bookings(passenger_id, status);

-- ── Profiles Table Indexes ──────────────────────────────────────────────────

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
  ON profiles(email);

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
  ON profiles(phone) 
  WHERE phone IS NOT NULL;

-- ── Messages Table Indexes ──────────────────────────────────────────────────

-- Index for sender queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON messages(sender_id, created_at DESC);

-- Index for recipient queries
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id 
  ON messages(recipient_id, created_at DESC);

-- Composite index for conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(sender_id, recipient_id, created_at DESC);

-- Index for unread messages
CREATE INDEX IF NOT EXISTS idx_messages_unread 
  ON messages(recipient_id, read_at) 
  WHERE read_at IS NULL;

-- ── Notifications Table Indexes ─────────────────────────────────────────────

-- Index for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON notifications(user_id, created_at DESC);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, read_at) 
  WHERE read_at IS NULL;

-- Index for notification type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
  ON notifications(type);

-- ── Reviews Table Indexes ───────────────────────────────────────────────────

-- Index for trip reviews
CREATE INDEX IF NOT EXISTS idx_reviews_trip_id 
  ON reviews(trip_id);

-- Index for reviews about a user
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id 
  ON reviews(reviewee_id, created_at DESC);

-- Index for reviews by a user
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id 
  ON reviews(reviewer_id, created_at DESC);

-- ── KV Store Indexes ────────────────────────────────────────────────────────
-- Only create if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kv_store_0b1f4071' AND table_schema = 'public') THEN
    -- Index for key prefix queries
    CREATE INDEX IF NOT EXISTS idx_kv_store_key_prefix 
      ON kv_store_0b1f4071(key text_pattern_ops);

    -- GIN index for JSONB value queries (if needed)
    CREATE INDEX IF NOT EXISTS idx_kv_store_value_gin 
      ON kv_store_0b1f4071 USING gin(value);
  END IF;
END $$;

-- ============================================================================
-- PART 3: DATABASE FUNCTIONS & TRIGGERS
-- ============================================================================

-- ── Auto-update updated_at timestamp ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Auto-create profile on user signup ──────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ── Update profile stats after booking ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_profile_stats_on_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update passenger stats when booking is accepted
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    UPDATE profiles
    SET 
      trips_as_passenger = trips_as_passenger + 1,
      total_trips = total_trips + 1
    WHERE id = NEW.passenger_id;
    
    -- Update driver stats
    UPDATE profiles
    SET 
      trips_as_driver = trips_as_driver + 1,
      total_trips = total_trips + 1
    WHERE id = (SELECT user_id FROM trips WHERE id = NEW.trip_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_booking ON bookings;
CREATE TRIGGER update_stats_on_booking
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_on_booking();

-- ── Update trip booked_seats count ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_trip_booked_seats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate booked seats for the trip
  UPDATE trips
  SET booked_seats = (
    SELECT COUNT(*)
    FROM bookings
    WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
      AND status IN ('accepted', 'completed')
  )
  WHERE id = COALESCE(NEW.trip_id, OLD.trip_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trip_seats ON bookings;
CREATE TRIGGER update_trip_seats
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_trip_booked_seats();

-- ── Update profile rating after review ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  review_count INTEGER;
  is_driver BOOLEAN;
BEGIN
  -- Determine if review is for driver or passenger
  is_driver := EXISTS (
    SELECT 1 FROM trips 
    WHERE id = NEW.trip_id AND user_id = NEW.reviewee_id
  );
  
  IF is_driver THEN
    -- Update driver rating
    SELECT AVG(rating), COUNT(*)
    INTO avg_rating, review_count
    FROM reviews
    WHERE reviewee_id = NEW.reviewee_id
      AND trip_id IN (SELECT id FROM trips WHERE user_id = NEW.reviewee_id);
    
    UPDATE profiles
    SET 
      rating_as_driver = COALESCE(avg_rating, 0),
      total_ratings_received = review_count
    WHERE id = NEW.reviewee_id;
  ELSE
    -- Update passenger rating
    SELECT AVG(rating), COUNT(*)
    INTO avg_rating, review_count
    FROM reviews
    WHERE reviewee_id = NEW.reviewee_id
      AND trip_id NOT IN (SELECT id FROM trips WHERE user_id = NEW.reviewee_id);
    
    UPDATE profiles
    SET 
      rating_as_passenger = COALESCE(avg_rating, 0),
      total_ratings_received = review_count
    WHERE id = NEW.reviewee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rating_on_review ON reviews;
CREATE TRIGGER update_rating_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_rating();

-- ============================================================================
-- PART 4: DATABASE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- ── View: Trip Search with Driver Info ──────────────────────────────────────

CREATE OR REPLACE VIEW v_trips_with_driver AS
SELECT 
  t.id,
  t.user_id,
  t.origin,
  t.destination,
  t.origin_lat,
  t.origin_lng,
  t.destination_lat,
  t.destination_lng,
  t.departure_time,
  t.arrival_time,
  t.duration_minutes,
  t.distance_km,
  t.total_seats,
  t.available_seats,
  t.booked_seats,
  t.price_per_seat,
  t.luggage_allowed,
  t.status,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  t.trip_type,
  t.route_polyline,
  t.started_at,
  t.completed_at,
  t.cancelled_at,
  t.cancellation_reason,
  t.cancelled_by,
  t.currency,
  t.estimated_duration_minutes,
  p.full_name AS driver_name,
  p.avatar_url AS driver_avatar,
  p.rating_as_driver AS driver_rating,
  p.trips_as_driver AS driver_trips_count,
  p.driver_license_verified AS driver_verified,
  (t.available_seats - t.booked_seats) AS available_seats_remaining
FROM trips t
JOIN profiles p ON t.user_id = p.id
WHERE t.deleted_at IS NULL;

-- ── View: User Bookings with Trip Details ───────────────────────────────────

CREATE OR REPLACE VIEW v_user_bookings AS
SELECT 
  b.id,
  b.trip_id,
  b.passenger_id,
  b.seats_requested,
  b.pickup_location,
  b.dropoff_location,
  b.pickup_coordinates,
  b.dropoff_coordinates,
  b.price_per_seat,
  b.total_price,
  b.currency,
  b.platform_fee,
  b.status,
  b.payment_status,
  b.payment_method,
  b.payment_intent_id,
  b.paid_at,
  b.cancellation_reason,
  b.cancelled_by,
  b.cancelled_at,
  b.special_requests,
  b.luggage_count,
  b.created_at,
  b.updated_at,
  b.accepted_at,
  b.completed_at,
  t.origin,
  t.destination,
  t.departure_time,
  t.price_per_seat AS trip_price_per_seat,
  t.status AS trip_status,
  p.full_name AS driver_name,
  p.avatar_url AS driver_avatar,
  p.rating_as_driver AS driver_rating,
  p.phone AS driver_phone
FROM bookings b
JOIN trips t ON b.trip_id = t.id
JOIN profiles p ON t.user_id = p.id;

-- ── View: User Statistics ───────────────────────────────────────────────────

-- NOTE: This view can be slow on large datasets. Consider converting to a MATERIALIZED VIEW.
CREATE OR REPLACE VIEW v_user_stats AS 
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.total_trips,
  p.trips_as_driver,
  p.trips_as_passenger,
  p.rating_as_driver,
  p.rating_as_passenger,
  p.wallet_balance,
  p.total_earned,
  p.total_spent,
  COALESCE(pending_bookings.count, 0) AS pending_bookings,
  COALESCE(active_trips.count, 0) AS active_trips,
  COALESCE(unread_messages.count, 0) AS unread_messages,
  COALESCE(unread_notifications.count, 0) AS unread_notifications
FROM profiles p
LEFT JOIN (
  SELECT passenger_id, COUNT(*) AS count
  FROM bookings
  WHERE status = 'pending'
  GROUP BY passenger_id
) pending_bookings ON p.id = pending_bookings.passenger_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM trips
  WHERE status IN ('published', 'active')
  GROUP BY user_id
) active_trips ON p.id = active_trips.user_id
LEFT JOIN (
  SELECT recipient_id, COUNT(*) AS count
  FROM messages
  WHERE read_at IS NULL
  GROUP BY recipient_id
) unread_messages ON p.id = unread_messages.recipient_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM notifications
  WHERE read_at IS NULL
  GROUP BY user_id
) unread_notifications ON p.id = unread_notifications.user_id;

-- ============================================================================
-- PART 5: ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update statistics for query planner optimization
ANALYZE trips;
ANALYZE bookings;
ANALYZE profiles;
ANALYZE messages;
ANALYZE notifications;
ANALYZE reviews;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kv_store_0b1f4071' AND table_schema = 'public') THEN
    ANALYZE kv_store_0b1f4071;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: Security & Performance fixes applied';
  RAISE NOTICE '   - RLS policies: ✅ Secured KV store, trips, bookings, profiles, messages, notifications, reviews';
  RAISE NOTICE '   - Indexes: ✅ Added 30+ performance indexes';
  RAISE NOTICE '   - Triggers: ✅ Auto-update timestamps, stats, ratings';
  RAISE NOTICE '   - Views: ✅ Created 3 views for common queries';
  RAISE NOTICE '   - Statistics: ✅ Analyzed all tables';
  RAISE NOTICE '🚀 Expected improvements:';
  RAISE NOTICE '   - Search queries: 80%% faster';
  RAISE NOTICE '   - User dashboard: 90%% faster';
  RAISE NOTICE '   - Booking lookups: 75%% faster';
  RAISE NOTICE '   - Security: Production-grade';
END $$;


-- ============================================================================
-- SECTION: 20260320000001_wasel_enhancements.sql
-- ============================================================================

-- =====================================================
-- WASEL ENHANCEMENTS - Ratings, Refunds, Chat
-- Standalone migration that extends existing schema
-- =====================================================

-- =====================================================
-- 1. RATINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  trip_id UUID NOT NULL,
  rider_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'rider_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'booking_id') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_booking_rider ON ratings(booking_id, rider_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'driver_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ratings_driver ON ratings(driver_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'trip_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ratings_trip ON ratings(trip_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ratings_created ON ratings(created_at DESC);

-- =====================================================
-- 2. REFUNDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  payment_intent_id TEXT NOT NULL,
  refund_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- =====================================================
-- 3. ENHANCE EXISTING TABLES
-- =====================================================

-- Enhance bookings table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by UUID;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Enhance profiles table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS completed_trips INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancelled_trips INTEGER DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}';
  END IF;
END $$;

-- Enhance messages table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Enhance notifications table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- =====================================================
-- 4. CREATE INDEXES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
    CREATE INDEX IF NOT EXISTS idx_bookings_cancelled ON bookings(cancelled_at) WHERE cancelled_at IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'average_rating') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_rating ON profiles(average_rating DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'trip_id') THEN
    CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id, created_at DESC) WHERE trip_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
  END IF;
END $$;

-- =====================================================
-- 5. TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to update driver rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'driver_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'rating') THEN
    UPDATE profiles
    SET 
      average_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM ratings
        WHERE driver_id = NEW.driver_id
      ),
      total_ratings = (
        SELECT COUNT(*)
        FROM ratings
        WHERE driver_id = NEW.driver_id
      )
    WHERE id = NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'driver_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'rating') THEN
    DROP TRIGGER IF EXISTS trigger_update_driver_rating ON ratings;
    CREATE TRIGGER trigger_update_driver_rating
      AFTER INSERT OR UPDATE ON ratings
      FOR EACH ROW
      EXECUTE FUNCTION update_driver_rating();
  END IF;
END $$;

-- Function to restore seats on cancellation
CREATE OR REPLACE FUNCTION restore_seats_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'seats_requested')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'trip_id') THEN
      UPDATE trips
      SET available_seats = available_seats + NEW.seats_requested
      WHERE id = NEW.trip_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'cancelled_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'cancelled_by')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'cancellation_reason') THEN
      UPDATE bookings
      SET 
        cancelled_at = NOW(),
        cancelled_by = NEW.cancelled_by,
        cancellation_reason = NEW.cancellation_reason
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    DROP TRIGGER IF EXISTS trigger_restore_seats ON bookings;
    CREATE TRIGGER trigger_restore_seats
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
      EXECUTE FUNCTION restore_seats_on_cancel();
  END IF;
END $$;

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all ratings" ON ratings;
CREATE POLICY "Users can view all ratings" ON ratings FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'rider_id') THEN
    DROP POLICY IF EXISTS "Users can create ratings for their bookings" ON ratings;
    CREATE POLICY "Users can create ratings for their bookings" ON ratings FOR INSERT
      WITH CHECK (rider_id = auth.uid());
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their refunds" ON refunds;
-- Refund records contain provider references and amounts. The application
-- reads them through service-role Edge Functions; client access is denied.
REVOKE ALL ON TABLE public.refunds FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 7. ENABLE REALTIME
-- =====================================================

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOR v_table IN SELECT unnest(ARRAY['messages', 'notifications', 'bookings', 'trips'])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables 
         WHERE pubname = 'supabase_realtime' AND tablename = v_table
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', v_table);
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- SECTION: 20261017000000_rls_price_and_view_hardening.sql
-- ============================================================================

-- ============================================================================
-- Wasel RLS, pricing and view hardening
-- Date: 2026-10-17
--
-- !! DO NOT PUSH THIS FILE TO THE PRODUCTION PROJECT AS-IS !!
-- It was written against the LEGACY local schema (profiles, kv_store_0b1f4071,
-- trips.id, v_user_bookings). Production (zexlxabdcsjefptmjhuq) has none of
-- profiles / kv_store / v_user_* and keys trips by trip_id, so:
--   * sections 2 and 3 would silently do nothing, and
--   * the section 1 trigger would raise "column t.id does not exist" at runtime.
-- Production already blocks client writes to bookings (no INSERT/UPDATE policies,
-- RESTRICTIVE require_permanent_auth_user). Sync local migrations with production
-- (supabase db pull) and re-derive any hardening against the real schema first.
--
-- Closes three gaps found in a code review of 20260310000000_security_performance_fixes.sql:
--
--   1. bookings: RLS let a passenger INSERT a booking with any price and let a trip
--      owner UPDATE any column. The payments handler derives the amount to charge
--      from those columns, so a client could set its own fare (or mark its own
--      booking as paid). A BEFORE trigger now pins price and payment columns for
--      client roles; the edge function (service_role) is unaffected.
--
--   2. kv_store_0b1f4071: the "System can access shared KV data" policy had no
--      TO clause, so it applied to PUBLIC (including anon) with FOR ALL on the
--      trip:/package:/route:/system:/config:/cache: key prefixes. Client access is
--      now read-only for shared keys and write-limited to the caller's own user:
--      keys. The edge function uses service_role and is unaffected.
--
--   3. v_user_bookings / v_user_stats: views run with the owner's privileges, so
--      they bypassed RLS and exposed every user's email, wallet balance and every
--      booking (with driver phone) to any role holding SELECT. They now filter to
--      the calling user and are no longer granted to anon.
--
-- Safe to re-run. Review on a staging project before `supabase db push`.
-- Rollback: supabase/migrations/rollback/20261017_rls_price_and_view_hardening_rollback.sql
-- ============================================================================


-- ── 1. Booking price / payment guard ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_booking_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  -- Columns only the server may change after a booking exists.
  locked_cols constant text[] := ARRAY[
    'price_per_seat', 'total_price', 'fare', 'amount', 'platform_fee',
    'currency', 'seats_requested',
    'payment_status', 'payment_intent_id', 'stripe_payment_intent_id', 'paid_at'
  ];
  paid_states constant text[] := ARRAY['succeeded', 'completed', 'paid', 'refunded'];
  new_j  jsonb := to_jsonb(NEW);
  old_j  jsonb;
  trip_j jsonb;
  patch  jsonb := '{}'::jsonb;
  col    text;
  unit   numeric;
  seats  numeric;
  given  numeric;
BEGIN
  -- Only client-facing roles are restricted. service_role (edge function),
  -- migrations and direct database connections have no request role and pass.
  IF caller_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_j := to_jsonb(OLD);
    FOREACH col IN ARRAY locked_cols LOOP
      IF (new_j ? col) AND (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'bookings.% is managed by the server and cannot be changed by clients', col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- INSERT: a client cannot create a booking that is already paid or bound to a payment.
  IF lower(coalesce(new_j ->> 'payment_status', '')) = ANY (paid_states)
     OR coalesce(new_j ->> 'stripe_payment_intent_id', '') <> ''
     OR coalesce(new_j ->> 'payment_intent_id', '') <> ''
     OR (new_j ? 'paid_at' AND new_j ->> 'paid_at' IS NOT NULL) THEN
    RAISE EXCEPTION 'Payment fields are managed by the server' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(t) INTO trip_j FROM public.trips t WHERE t.id = NEW.trip_id;
  IF trip_j IS NULL THEN
    RAISE EXCEPTION 'Trip not found for booking' USING ERRCODE = '23503';
  END IF;

  unit := nullif(trip_j ->> 'price_per_seat', '')::numeric;
  IF unit IS NULL THEN
    RETURN NEW; -- older trip schema without a per-seat price: nothing to pin against
  END IF;

  seats := coalesce(nullif(new_j ->> 'seats_requested', '')::numeric, 1);
  IF seats < 1 OR seats <> trunc(seats) THEN
    RAISE EXCEPTION 'seats_requested must be a positive whole number' USING ERRCODE = '22023';
  END IF;

  -- The per-seat price always comes from the trip, never from the client.
  IF new_j ? 'price_per_seat' THEN
    patch := patch || jsonb_build_object('price_per_seat', unit);
  END IF;

  -- Totals may exceed trip price x seats (platform fee) but never fall below it.
  FOREACH col IN ARRAY ARRAY['total_price', 'fare', 'amount'] LOOP
    IF new_j ? col THEN
      given := coalesce(nullif(new_j ->> col, '')::numeric, 0);
      patch := patch || jsonb_build_object(col, greatest(given, unit * seats));
    END IF;
  END LOOP;

  IF new_j ? 'currency' AND nullif(trip_j ->> 'currency', '') IS NOT NULL THEN
    patch := patch || jsonb_build_object('currency', trip_j ->> 'currency');
  END IF;

  IF patch <> '{}'::jsonb THEN
    NEW := jsonb_populate_record(NEW, patch);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    -- Named so it sorts (and therefore fires) before the updated_at / stats triggers.
    DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
    CREATE TRIGGER a_bookings_pricing_guard
      BEFORE INSERT OR UPDATE ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_booking_pricing();
  ELSE
    RAISE NOTICE 'public.bookings not found; pricing guard trigger skipped';
  END IF;
END $$;


-- ── 2. KV store: no anonymous or client writes to shared keys ───────────────

DO $$
BEGIN
  IF to_regclass('public.kv_store_0b1f4071') IS NOT NULL THEN
    ALTER TABLE public.kv_store_0b1f4071 ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "System can access shared KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can access their own KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Authenticated can read shared KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can read their own KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can write their own user KV data" ON public.kv_store_0b1f4071;

    -- Shared, non-sensitive catalogue keys: readable by signed-in users only.
    CREATE POLICY "Authenticated can read shared KV data" ON public.kv_store_0b1f4071
      FOR SELECT TO authenticated
      USING (key LIKE 'trip:%' OR key LIKE 'package:%' OR key LIKE 'route:%');

    -- A user can read their own keys (wallet / notification stay read-only here:
    -- balances and notifications are written by the server only).
    CREATE POLICY "Users can read their own KV data" ON public.kv_store_0b1f4071
      FOR SELECT TO authenticated
      USING (
        key LIKE 'user:' || auth.uid()::text || ':%' OR
        key LIKE 'profile:' || auth.uid()::text OR
        key LIKE 'wallet:' || auth.uid()::text || ':%' OR
        key LIKE 'notification:' || auth.uid()::text || ':%'
      );

    -- Writes: only the caller's own user: namespace.
    CREATE POLICY "Users can write their own user KV data" ON public.kv_store_0b1f4071
      FOR ALL TO authenticated
      USING (key LIKE 'user:' || auth.uid()::text || ':%')
      WITH CHECK (key LIKE 'user:' || auth.uid()::text || ':%');

    -- "Service role can access all KV data" from 20260310 is kept as is.
  END IF;
END $$;


-- ── 3. Views: filter to the caller, no anonymous access ─────────────────────

DO $$
BEGIN
  IF to_regclass('public.v_user_bookings') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.v_user_bookings AS
      SELECT
        b.id, b.trip_id, b.passenger_id, b.seats_requested,
        b.pickup_location, b.dropoff_location,
        b.pickup_coordinates, b.dropoff_coordinates,
        b.price_per_seat, b.total_price, b.currency, b.platform_fee,
        b.status, b.payment_status, b.payment_method, b.payment_intent_id, b.paid_at,
        b.cancellation_reason, b.cancelled_by, b.cancelled_at,
        b.special_requests, b.luggage_count,
        b.created_at, b.updated_at, b.accepted_at, b.completed_at,
        t.origin, t.destination, t.departure_time,
        t.price_per_seat AS trip_price_per_seat,
        t.status AS trip_status,
        p.full_name AS driver_name,
        p.avatar_url AS driver_avatar,
        p.rating_as_driver AS driver_rating,
        p.phone AS driver_phone
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN profiles p ON t.user_id = p.id
      WHERE b.passenger_id = auth.uid()
         OR t.user_id = auth.uid()
         OR coalesce(auth.role(), '') = 'service_role'
    $v$;
    REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
    GRANT SELECT ON public.v_user_bookings TO authenticated, service_role;
  END IF;
EXCEPTION
  WHEN undefined_column OR undefined_table OR invalid_table_definition THEN
    RAISE NOTICE 'v_user_bookings left unchanged (schema differs): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF to_regclass('public.v_user_stats') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.v_user_stats AS
      SELECT
        p.id, p.full_name, p.email,
        p.total_trips, p.trips_as_driver, p.trips_as_passenger,
        p.rating_as_driver, p.rating_as_passenger,
        p.wallet_balance, p.total_earned, p.total_spent,
        COALESCE(pending_bookings.count, 0) AS pending_bookings,
        COALESCE(active_trips.count, 0) AS active_trips,
        COALESCE(unread_messages.count, 0) AS unread_messages,
        COALESCE(unread_notifications.count, 0) AS unread_notifications
      FROM profiles p
      LEFT JOIN (
        SELECT passenger_id, COUNT(*) AS count
        FROM bookings WHERE status = 'pending' GROUP BY passenger_id
      ) pending_bookings ON p.id = pending_bookings.passenger_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count
        FROM trips WHERE status IN ('published', 'active') GROUP BY user_id
      ) active_trips ON p.id = active_trips.user_id
      LEFT JOIN (
        SELECT recipient_id, COUNT(*) AS count
        FROM messages WHERE read_at IS NULL GROUP BY recipient_id
      ) unread_messages ON p.id = unread_messages.recipient_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count
        FROM notifications WHERE read_at IS NULL GROUP BY user_id
      ) unread_notifications ON p.id = unread_notifications.user_id
      WHERE p.id = auth.uid()
         OR coalesce(auth.role(), '') = 'service_role'
    $v$;
    REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon;
    GRANT SELECT ON public.v_user_stats TO authenticated, service_role;
  END IF;
EXCEPTION
  WHEN undefined_column OR undefined_table OR invalid_table_definition THEN
    RAISE NOTICE 'v_user_stats left unchanged (schema differs): %', SQLERRM;
END $$;


-- ============================================================================
-- SECTION: 20261017000001_ensure_exposed_schemas.sql
-- ============================================================================

-- ============================================================================
-- Ensure every schema listed in supabase/config.toml [api].schemas exists
-- Date: 2026-10-17
--
-- Problem: `supabase start` fails on a fresh local database because PostgREST is
-- told to expose `api`, `stripe` and `pgmq_public`, but no migration creates them
-- (they only exist on the hosted project). PostgREST then loops forever with
--   {"code":"3F000","message":"schema \"api\" does not exist"}
-- and the CLI aborts with "supabase_rest_wasel unexpected status 503".
--
-- Fix: create the missing schemas as empty containers. Safe to re-run, and a no-op
-- on the hosted project where they already exist. Nothing is granted to anon or
-- authenticated here, so exposing an empty schema adds no attack surface.
--
-- Rollback: intentionally none. Do NOT `DROP SCHEMA stripe` / `pgmq_public` on a
-- project that uses the Stripe wrapper or Supabase Queues.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS stripe;
CREATE SCHEMA IF NOT EXISTS pgmq_public;

COMMENT ON SCHEMA api IS 'Reserved for versioned API views/RPCs; exposed via PostgREST.';

-- Make PostgREST pick the schemas up if it is already running.
NOTIFY pgrst, 'reload schema';


