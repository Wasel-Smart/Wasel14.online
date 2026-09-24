import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';

const renames = [
  [ '20260224_wasel_complete_schema.sql', '20260224000003_wasel_complete_schema.sql' ],
  [ '20260224_postgis_functions.sql', '20260224000004_postgis_functions.sql' ],
  [ '20260302_regionalization_schema.sql', '20260302000000_regionalization_schema.sql' ],
  [ '20260310_security_performance_fixes.sql', '20260310000000_security_performance_fixes.sql' ]
];

for ( const [ oldName, newName ] of renames ) {
  const oldPath = path.join( dir, oldName );
  const newPath = path.join( dir, newName );
  if ( fs.existsSync( oldPath ) ) {
    fs.renameSync( oldPath, newPath );
    console.log( `Renamed ${ oldName } -> ${ newName }` );
  }
}

// Remove empty placeholder migrations
const files = fs.readdirSync( dir );
for ( const file of files ) {
  if ( file.endsWith( '.sql' ) ) {
    const fullPath = path.join( dir, file );
    const stat = fs.statSync( fullPath );
    if ( stat.size === 0 ) {
      fs.unlinkSync( fullPath );
      console.log( `Removed empty migration: ${ file }` );
    }
  }
}

