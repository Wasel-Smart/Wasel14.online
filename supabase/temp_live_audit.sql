WITH flagged(table_name) AS (
  VALUES ('admin_logs'), ('api_rate_limits'), ('audit_logs'), ('backup_logs'),
         ('driver_payouts'), ('event_outbox'), ('otp_sessions'), ('package_events'), ('trip_presence')
), tables AS (
  SELECT f.table_name, c.relrowsecurity AS rls_enabled,
         pg_get_userbyid(c.relowner) AS owner,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('role', grantee, 'privilege', privilege_type, 'grantable', is_grantable) ORDER BY grantee, privilege_type)
                   FROM information_schema.role_table_grants g
                   WHERE g.table_schema='public' AND g.table_name=f.table_name
                     AND g.grantee IN ('anon','authenticated','service_role')), '[]'::jsonb) AS grants,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('name', policyname, 'roles', roles, 'command', cmd, 'using', qual, 'check', with_check) ORDER BY policyname)
                   FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=f.table_name), '[]'::jsonb) AS policies
  FROM flagged f JOIN pg_class c ON c.oid = to_regclass('public.' || f.table_name)
), driver_locations AS (
  SELECT c.relrowsecurity AS rls_enabled, pg_get_userbyid(c.relowner) AS owner,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('role', grantee, 'privilege', privilege_type, 'grantable', is_grantable) ORDER BY grantee, privilege_type)
                   FROM information_schema.role_table_grants g
                   WHERE g.table_schema='public' AND g.table_name='driver_locations'
                     AND g.grantee IN ('anon','authenticated','service_role')), '[]'::jsonb) AS grants,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('name', policyname, 'roles', roles, 'command', cmd, 'using', qual, 'check', with_check) ORDER BY policyname)
                   FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='driver_locations'), '[]'::jsonb) AS policies
  FROM pg_class c WHERE c.oid = to_regclass('public.driver_locations')
), indexes AS (
  SELECT ns.nspname AS schema, tbl.relname AS table_name, idx.relname AS index_name,
         pg_get_userbyid(idx.relowner) AS owner, pg_relation_size(idx.oid) AS bytes,
         pg_stat_get_numscans(idx.oid) AS scans, pg_get_indexdef(idx.oid) AS definition,
         con.contype AS constraint_type
  FROM pg_class idx JOIN pg_index i ON i.indexrelid=idx.oid
  JOIN pg_class tbl ON tbl.oid=i.indrelid JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  LEFT JOIN pg_constraint con ON con.conindid=idx.oid
  WHERE idx.relkind='i' AND pg_stat_get_numscans(idx.oid)=0
)
SELECT jsonb_build_object(
 'stats_reset', (SELECT stats_reset FROM pg_stat_database WHERE datname=current_database()),
 'current_database', current_database(),
 'flagged_tables', (SELECT jsonb_agg(to_jsonb(t) ORDER BY table_name) FROM tables t),
 'driver_locations', (SELECT to_jsonb(d) FROM driver_locations d),
 'unused_index_count', (SELECT count(*) FROM indexes),
 'unused_indexes', (SELECT jsonb_agg(jsonb_build_object('schema',schema,'table',table_name,'index',index_name,'owner',owner,'bytes',bytes,'scans',scans,'constraint_type',constraint_type,'definition',definition) ORDER BY schema,table_name,index_name) FROM indexes),
 'table_stats', (SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',relname,'seq_scan',seq_scan,'idx_scan',idx_scan,'inserts',n_tup_ins,'updates',n_tup_upd,'deletes',n_tup_del,'live_rows',n_live_tup) ORDER BY schemaname,relname) FROM pg_stat_user_tables WHERE relname IN ('admin_logs','api_rate_limits','audit_logs','backup_logs','driver_payouts','event_outbox','otp_sessions','package_events','trip_presence','driver_locations'))
) AS inspection;
