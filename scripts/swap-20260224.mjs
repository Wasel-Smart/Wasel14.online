import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';

const tempA = path.join( dir, 'temp_wasel_complete.sql' );
const tempB = path.join( dir, 'temp_additional_tables.sql' );
const tempC = path.join( dir, 'temp_postgis_functions.sql' );

fs.renameSync( path.join( dir, '20260224000003_wasel_complete_schema.sql' ), tempA );
fs.renameSync( path.join( dir, '20260224000002_additional_tables.sql' ), tempB );
fs.renameSync( path.join( dir, '20260224000004_postgis_functions.sql' ), tempC );

fs.renameSync( tempA, path.join( dir, '20260224000002_wasel_complete_schema.sql' ) );
fs.renameSync( tempB, path.join( dir, '20260224000004_additional_tables.sql' ) );
fs.renameSync( tempC, path.join( dir, '20260224000003_postgis_functions.sql' ) );

console.log( 'Successfully swapped 20260224 migrations order.' );

