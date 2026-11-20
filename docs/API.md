# RJNX API

Use same-origin HTTP. Protected calls require the session cookie. Writes with JSON payloads require `Content-Type: application/json`. Media uses a raw binary request body. Errors use `{ "error": "…" }` and `400`, `401`, `403`, `404`, `409`, `413`, `415`, `422`, `429` or `503` as applicable. Rate-limited requests include `Retry-After`. Private reads and mutations use `Cache-Control: private, no-store`.

| Route | Method and purpose |
| --- | --- |
| `/api/health` | GET, PostgreSQL readiness |
| `/api/session` | POST `{action: "register", email, username, password}`; `login` with email/password; `logout`; `forgot` with email; `reset` with password and verified recovery session |
| `/auth/confirm` | GET, verifies Supabase `token_hash` and `type`, or exchanges a `code` for verification sign-in |
| `/api/contact` | POST `{email,subject,body}`, creates a private report |
| `/api/leaderboard` | GET, optional `type=teams`, `game`, `tournament`, `season`, `q`, `page`; returns verified, paginated aggregates |
| `/api/media/:purpose` | POST PNG, JPEG or WebP (max 3 MiB); purpose `avatar`, `team`, `tournament`, `news`, `proof`, `site`; returns `{id,url}` |
| `/api/media/:id` | GET, access is based on ownership, staff permissions, or a visible public record that references the image |
| `/api/me/profile` | PUT, edits only the signed-in player’s allowed fields |
| `/api/me/teams` · `/api/me/teams/:id` | POST create, PUT update |
| `/api/me/teams/:id/invite` | POST `{username}`; invites a verified app player |
| `/api/me/invitations/:id` | PATCH `{status: "accepted" | "rejected" | "cancelled"}` |
| `/api/me/teams/:id/members` | PATCH `{userId,action: "remove" | "member" | "co_captain" | "transfer"}` |
| `/api/me/registrations` | POST `{tournamentId,teamId,rulesAccepted,players:[{id,ign}],note}` |
| `/api/me/registrations/:id` | DELETE, withdraw while permitted |
| `/api/me/matches/:id/room` | GET, only authorized staff or assigned approved participant with released details; never part of public or player HTML |
| `/api/me/notifications` | GET, the current user’s newest 30 items and unread count; `?summary=1` returns only the count |
| `/api/me/notifications/realtime` | GET, current user’s short-lived connection ticket; only when private Supabase Realtime is enabled |
| `/api/me/notifications/:id` | PATCH; use `all` or a notification ID to mark read |

Staff writes: `/api/admin/games` POST, `/api/admin/tournaments` POST and `/:id` PUT/DELETE (archive), `/api/admin/registrations/:id` PATCH, `/api/admin/matches` POST and `/:id` PUT, `/api/admin/results/:id` PUT (submit/correct) and `/:id/publish` POST (Admin/Super Admin only), `/api/admin/users/:id` PATCH, `/api/admin/teams/:id` PATCH, `/api/admin/news` POST and `/:id` PUT/DELETE (unpublish), `/api/admin/announcements` POST and `/:id` PUT, `/api/admin/reports/:id` PATCH, `/api/admin/settings` PUT. The authoritative contracts are the Zod schemas in `src/lib/validation.ts`. Identity and permissions are checked at request time and are not supplied in mutation payloads.

Scoring: `placement + kills × killPoints + winPoints if first + bonus − penalty`. Every assigned entry has one unique position. Draft scores do not count. Team match results are credited to the registered roster as a whole; individual kill counts are not inferred. Scores are not automatically imported from game servers. Tournament formats are supported as scheduling/rules choices; staff create the fixtures and determine advancement. Reports are private and staff resolution notes are internal.
