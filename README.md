# RJNX GAMING ESPORTS

**PLAY. COMPETE. CONQUER.**

RJNX is a Next.js esports arena with public tournament, player, team and news directories; a private player dashboard; and a role-based staff control center. Competition data is persisted in PostgreSQL. The local preview uses explicitly seeded development records and calculates stats and rankings from the database. No example admin account or password is included.

## Requirements and local setup

- Node.js 22+, npm, and PostgreSQL 15+.
- Run `npm ci`. Copy `.env.example` to `.env` and set `DATABASE_URL` to a **local** PostgreSQL database. `MIGRATION_DATABASE_URL` can override it for DDL. Use an isolated database for tests. Use `createuser --pwprompt` and `createdb --owner` (or your PostgreSQL admin UI) to prepare a database.
- Run `npx drizzle-kit migrate`. The `rjnx` schema is isolated and a starter game catalog is included. `node scripts/dev-seed.mjs` is optional: it loads local sample events, public players, teams, news, results, and standings. It is guarded against hosted execution and never creates credentials.
- Run `npm run dev`; visit `http://localhost:3000`. When Supabase settings are absent, RJNX permits PostgreSQL test accounts on a loopback DB only. These use scrypt passwords and revocable session digests. Local mode does not send email or pretend to verify it. Vercel and `RJNX_AUTH_MODE=supabase` disable local account fallback.
- Register an operator with your own unique handle and sign in. Initialize the first local or hosted Super Admin with `node scripts/bootstrap-admin.mjs <operator-handle>` using operator database access. The script refuses to run if any Super Admin already exists and checks the underlying account. Sign back in or refresh `/admin`. Additional staff privileges are assigned by an existing Super Admin from Users. Never seed default staff credentials.

## Hosted Supabase and Vercel

1. Provision a Supabase project and use a trusted database owner or migration connection to run `npx drizzle-kit migrate`. The migration creates a NOLOGIN `rjnx_runtime` role with grants and RLS policies in the private schema. Create a dedicated LOGIN role for the Next server with a strong generated password and grant it `rjnx_runtime`, plus `CONNECT` to the application database. Keep migration credentials out of Vercel runtime. Do **not** add `rjnx` to Supabase’s exposed Data API schemas. Browser writes go through same-origin Next API routes.
2. In the Supabase SQL editor, apply `supabase/configure.sql` to create the private `rjnx-media` Storage bucket. The server reads Storage only after checking permissions. For optional private Realtime, enable Supabase Broadcast, apply `supabase/realtime.sql`, and set `RJNX_REALTIME_ENABLED=1`. Run regular backups on PostgreSQL and, separately, the Storage objects. Do not enable public access to the media bucket.
3. In Supabase Auth, enable email/password and **Confirm email**. Set Site URL to your exact HTTPS production origin and allow its `/auth/confirm` redirect (and explicitly approved staging origins). Configure verified SMTP and test deliverability. Use the [Supabase email template docs](https://supabase.com/docs/guides/auth/auth-email-templates) to configure token-hash links:
   - Confirm signup link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
   - Reset password link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - Use the same hostname for the email routes, cookies, and website. Disable link rewriting/scanning for transactional links when supported; recovery links contain one-time credentials. The default OAuth/PKCE exchange is available for verification codes, but **recovery needs the recovery template** above.
4. Import the repository into Vercel with the Next.js preset. Set the variables below for Production (and separately for staging); point `DATABASE_URL` to a TLS-verified Supabase connection or Supavisor pooler suitable for your network. Use low pool sizes; RJNX caps each Vercel instance to three connections. Restrict the database network to your hosting arrangement. Build with `npm run build`. Apply migrations out of band before deployment, not on every preview build. Keep the PostgreSQL schema and migration connection out of the client bundle.
5. Verify `/api/health`, `/robots.txt`, `/sitemap.xml`, verification and recovery emails, real account creation, first-admin bootstrap, private Storage/proof permissions, and a complete staged tournament. Then publish production content. Deployment and the real Supabase flow require your own project credentials and provider and are not implied by the local preview.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Private PostgreSQL runtime URL. Required for local and hosted operation. |
| `MIGRATION_DATABASE_URL` | Optional separate DDL/operator URL, for the CLI only. |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical URL, production only. Enables expected write-origin checks and anti-framing headers. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; `NEXT_PUBLIC_SUPABASE_ANON_KEY` works for older projects. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only private Storage credential. Never set a `NEXT_PUBLIC_` version. |
| `RJNX_AUTH_MODE` | Set `supabase` for hosted runs; prevents local auth fallback. |
| `RJNX_REALTIME_ENABLED` | Optional: `1` enables private Supabase notification invalidations; leave unset for 20-second polling only. |
| `TRUST_PROXY` | Use `1` only on a private proxy that overwrites `X-Real-IP`; Vercel can use its trusted forwarding header. |

## Daily operations

- Player: create profile and team, accept invitations, submit an entry and track approval. Approved assigned competitors can reveal private match rooms after the organizer releases them. Read and mark in-app notices in Notifications.
- Manager: create a valid event and set registration status, review entries, schedule matches for approved entrants, then enter scorecards with proof if needed.
- Admin: verify and publish submitted scores; published standings recompute on read. Publishing sends notices. Corrections leave a revision and withdraw the previous score until republished. Edit tournament status and archive finished or cancelled competitions. Create news, schedule publication, send announcements, and maintain homepage copy, banner, and FAQs.
- Moderator: review submitted reports and team moderation. Super Admin manages staff privileges. Role and suspension changes are logged. No audit event includes room passwords.
- Tournaments are free-entry; there is no checkout, payment collection, gambling or wagering. Formats are available as configured rule sets and match schedules; automatic bracket generation or game-server imports are not included.
- Notifications update on navigation and use 20-second same-origin polling while the page is visible. Optional Supabase Realtime sends only a refresh signal on each player’s private channel. The browser uses its own short-lived Supabase access token in memory; password, service secret, refresh cookies, and notification contents are never broadcast.

## Verification

`npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, `npm run lint`, `npm run build`, `npx drizzle-kit check`, and `npm audit --omit=dev` are supported. See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md) and [release checklist](docs/RELEASE.md).

For live regression tests, use the migrated **disposable** local database against a running build. Install Chromium (`npx playwright install --with-deps chromium --only-shell` on Linux) and run `RJNX_TEST_DATABASE_URL=<local-db-url> BASE_URL=http://localhost:3000 node --test --test-concurrency=1 tests/*.test.mjs`. Tests create and tear down scoped rows and use controlled role fixtures, not fixed credentials. `SCREENSHOT_DIR=test-results` saves responsive review images. An absent test DB URL skips the live suites.

## Security and maintenance

- Do not make the DB or private Storage objects public. Scope DDL separately from server runtime. Review RLS and grants under the operator account after migration. Rotate secret keys and restore from backup in staging before production.
- Public pages never project room credential rows or unverified results. Retain audit logs and results according to your privacy policy. Administratively back up and expire local sessions and rate buckets where relevant. For a sustained production deployment, monitor login, request errors, and Storage usage.
- Image uploads are bounded, decoded, resized, and re-encoded as metadata-free WebP. The accepted inputs are PNG, JPEG and WebP. The serving API sets explicit content types; uploaded SVG and executable formats aren’t accepted. Consider independent malware/content moderation and storage lifecycle policies before large public usage.
- The included legal text should be reviewed and adapted to your organization, jurisdiction and event rules before public launch. For personal data requests, direct players to the included contact form and staff queue.

To create a clean source archive, run `bash scripts/package-source.sh`. It validates essential files and excludes the actual `.env`, installed packages, local screenshots, and build output.
