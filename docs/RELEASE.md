# Acceptance and release checklist

- Public homepage, directory and detail routes derive their competition records and metrics from PostgreSQL. Sample records live in a separate development-only seed.
- Local sign-up, authentication, session handling, profile editing, team invitations, tournament entry, capacity, staff queues, room authorization, result verification and rankings can be exercised without external credentials.
- Staging gates: configure real Supabase Auth/SMTP and Storage; optionally enable private Realtime and verify owner-only subscriptions; apply hosted policies; verify email delivery and password reset; initialize a verified operator account; run staged smoke tests; review legal terms; verify alerts and backups before opening registration to the public.
- Intentionally not in scope: payment handling, entry fees, wagering, automatic bracket advancement, external-game result ingestion, email newsletter, and public production deployment without credentials.
- The source ZIP omits secrets, build output, installed dependencies, and all database data other than the explicitly local seed.
