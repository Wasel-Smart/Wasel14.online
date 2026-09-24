import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';
const files = fs.readdirSync( dir ).filter( f => f.endsWith( '.sql' ) );

for ( const file of files ) {
  const filePath = path.join( dir, file );
  let content = fs.readFileSync( filePath, 'utf8' );

  // Fix any single-dollar DO $ or END $
  content = content.split( 'DO $ \n' ).join( 'DO $$\n' );
  content = content.split( 'DO $\n' ).join( 'DO $$\n' );
  content = content.split( 'END $;' ).join( 'END $$;' );
  content = content.split( 'END $\n' ).join( 'END $$\n' );
  content = content.split( '$$$' ).join( '$$' );

  fs.writeFileSync( filePath, content, 'utf8' );
}
console.log( 'Fixed all DO $$ blocks.' );

