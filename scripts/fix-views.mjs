import fs from 'fs';

let file1 = 'supabase/migrations/20260224000000_production_backend_schema.sql';
let content1 = fs.readFileSync( file1, 'utf8' );

const newView1 = `CREATE OR REPLACE VIEW trip_search_view AS
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
AND (t.departure_date >= CURRENT_DATE OR t.departure_date IS NULL);`;

content1 = content1.replace( /CREATE\s+OR\s+REPLACE\s+VIEW\s+trip_search_view\s+AS[\s\S]*?WHERE\s+t\.status\s*=\s*'published'[\s\S]*?;/i, newView1 );
fs.writeFileSync( file1, content1, 'utf8' );
console.log( 'Successfully updated trip_search_view in 20260224000000_production_backend_schema.sql' );

