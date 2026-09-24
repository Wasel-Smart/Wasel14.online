import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';
const files = fs.readdirSync( dir ).filter( f => f.endsWith( '.sql' ) );

let modifiedFiles = 0;
for ( const file of files ) {
  const filePath = path.join( dir, file );
  let content = fs.readFileSync( filePath, 'utf8' );
  let original = content;

  // 1. Remove invalid CHECK constraint with SELECT
  content = content.replace( /CONSTRAINT\s+no_self_booking\s+CHECK\s*\(\s*passenger_id\s*!=\s*\(\s*SELECT\s+driver_id\s+FROM\s+(?:public\.)?trips\s+WHERE\s+id\s*=\s*trip_id\s*\)\s*\)\s*,?/gi, '' );

  // 2. Ensure CREATE INDEX has IF NOT EXISTS
  content = content.replace( /CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, ( match, p1 ) => {
    return 'CREATE ' + ( p1 || '' ) + 'INDEX IF NOT EXISTS ';
  } );

  // 3. Ensure CREATE POLICY is preceded by DROP POLICY IF EXISTS
  content = content.replace( /(?:DROP\s+POLICY\s+IF\s+EXISTS\s+("[^"]+"|[\w_]+)\s+ON\s+([^\s;]+)\s*;\s*)?CREATE\s+POLICY\s+("[^"]+"|[\w_]+)\s+ON\s+([^\s]+)/gi, ( match, dropPolicyName, dropTable, policyName, table ) => {
    return 'DROP POLICY IF EXISTS ' + policyName + ' ON ' + table + ';\nCREATE POLICY ' + policyName + ' ON ' + table;
  } );

  // 4. Ensure CREATE TRIGGER is preceded by DROP TRIGGER IF EXISTS
  content = content.replace( /(?:DROP\s+TRIGGER\s+IF\s+EXISTS\s+([\w_]+)\s+ON\s+([^\s;]+)\s*;\s*)?CREATE\s+TRIGGER\s+([\w_]+)\s+(?:BEFORE|AFTER|INSTEAD\s+OF)\s+[\w\s_]+\s+ON\s+([^\s]+)/gi, ( match, dropTrig, dropTab, trigName, tab ) => {
    const createStmt = match.replace( /^DROP\s+TRIGGER[^\n]*\n?/i, '' );
    return 'DROP TRIGGER IF EXISTS ' + trigName + ' ON ' + tab + ';\n' + createStmt;
  } );

  if ( content !== original ) {
    fs.writeFileSync( filePath, content, 'utf8' );
    modifiedFiles++;
    console.log( 'Updated: ' + file );
  }
}
console.log( 'Total modified files: ' + modifiedFiles );

