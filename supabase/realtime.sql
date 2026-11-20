-- Optional. Apply only after Drizzle migrations and supabase/configure.sql.
-- Authenticated sockets may subscribe only to their own private invalidation channel.
-- This policy and trigger never deliver the notification body or other private rows.
DROP POLICY IF EXISTS rjnx_inbox_broadcast ON realtime.messages;
CREATE POLICY rjnx_inbox_broadcast ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND (SELECT realtime.topic()) = ('rjnx:inbox:' || (SELECT auth.uid())::text));
DROP POLICY IF EXISTS rjnx_inbox_owner_only ON realtime.messages;
CREATE POLICY rjnx_inbox_owner_only ON realtime.messages AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING ((SELECT realtime.topic()) NOT LIKE 'rjnx:inbox:%' OR (SELECT realtime.topic()) = ('rjnx:inbox:' || (SELECT auth.uid())::text));
DROP POLICY IF EXISTS rjnx_inbox_server_invalidation ON realtime.messages;
CREATE POLICY rjnx_inbox_server_invalidation ON realtime.messages AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((SELECT realtime.topic()) NOT LIKE 'rjnx:inbox:%');

CREATE OR REPLACE FUNCTION rjnx.broadcast_inbox_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send('{"changed":true}'::jsonb,'changed','rjnx:inbox:' || NEW.user_id::text,true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A transient Realtime issue should not abort registration, match, or result writes.
  RAISE WARNING 'RJNX inbox invalidation failed for notification %', NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION rjnx.broadcast_inbox_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS rjnx_inbox_invalidation ON rjnx.notifications;
CREATE TRIGGER rjnx_inbox_invalidation AFTER INSERT ON rjnx.notifications
  FOR EACH ROW EXECUTE FUNCTION rjnx.broadcast_inbox_change();
