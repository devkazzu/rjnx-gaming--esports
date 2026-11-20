-- Restrict direct Data API access; all application mutations use the private Next server.
DO $$
DECLARE item record;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rjnx_runtime') THEN
    CREATE ROLE rjnx_runtime NOLOGIN;
  END IF;
  REVOKE ALL ON SCHEMA rjnx FROM PUBLIC;
  GRANT USAGE ON SCHEMA rjnx TO rjnx_runtime;
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'rjnx' LOOP
    EXECUTE format('ALTER TABLE rjnx.%I ENABLE ROW LEVEL SECURITY', item.tablename);
    EXECUTE format('REVOKE ALL ON TABLE rjnx.%I FROM PUBLIC', item.tablename);
    EXECUTE format('CREATE POLICY server_only ON rjnx.%I FOR ALL TO rjnx_runtime USING (true) WITH CHECK (true)', item.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rjnx.%I TO rjnx_runtime', item.tablename);
  END LOOP;
  REVOKE UPDATE, DELETE ON rjnx.audit_logs, rjnx.result_history FROM rjnx_runtime;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA rjnx FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA rjnx FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    REVOKE ALL ON SCHEMA rjnx FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA rjnx FROM authenticated;
    CREATE POLICY notification_owner ON rjnx.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO rjnx.games (slug,name,artwork) VALUES
 ('valorant','Valorant','/images/rjnx-valorant.jpg'),
 ('bgmi','BGMI','/images/rjnx-bgmi.jpg'),
 ('free-fire','Free Fire','/images/rjnx-freefire.jpg'),
 ('pubg-mobile','PUBG Mobile',NULL),
 ('call-of-duty-mobile','Call of Duty Mobile',NULL),
 ('minecraft','Minecraft',NULL)
ON CONFLICT DO NOTHING;
