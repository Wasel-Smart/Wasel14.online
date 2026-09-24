import fs from 'fs';

const file = 'supabase/migrations/20260224000001_backup_configuration.sql';
let content = fs.readFileSync( file, 'utf8' );

content = content.replace( /schemaname\s*\|\|\s*'\.'\s*\|\|\s*tablename/g, "schemaname || '.' || relname" );
content = content.replace( /tablename\s+AS\s+table_name/g, "relname AS table_name" );
content = content.replace( /SELECT\s+log_backup\('manual',\s*'completed',\s*ARRAY\['initial_setup'\],\s*NULL\);?/g, "-- SELECT log_backup('manual', 'completed', ARRAY['initial_setup'], NULL);" );

fs.writeFileSync( file, content, 'utf8' );
console.log( 'Fixed relname in 20260224000001_backup_configuration.sql' );

