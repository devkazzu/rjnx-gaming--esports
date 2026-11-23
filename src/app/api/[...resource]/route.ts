
import { z } from "zod";
import { db } from "@/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { notifications } from "@/db/schema";
import { ADMIN, can, MANAGEMENT, STAFF, type Role } from "@/lib/model";
import { supabaseConfig, supabaseServer } from "@/lib/supabase";
import * as v from "@/lib/validation";
import { authenticate, identity, viewer } from "@/server/auth";
import {
  archiveTournament, applyTournament, publishResults,
  reviewEntry, saveMatch, saveTournament, submitResults, withdraw
} from "@/server/competition";
import {
  changeUser, markNotice, newReport, saveAnnouncement,
  saveGame, saveNews, saveOwnProfile, unpublishNews,
  updateReport, updateSettings
} from "@/server/content";
import {
  address, failure, Fault, input, limit, reply,
  sameOrigin, uuid
} from "@/server/http";
import { getMedia, purposes, upload, type Purpose } from "@/server/media";
import {
  invite, manageMember, moderateTeam, respondInvite, saveTeam
} from "@/server/teams";
import { leaderboard, roomFor } from "@/server/reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ resource: string[] }>;
};

const success = (id?: string, status = 200) =>
  reply({ ok: true, ...(id ? { id } : {}) }, status);

async function handle(request: Request, context: Context) {
  const [scope, resource, item, action, ...rest] =
    (await context.params).resource;

  const method = request.method;

  try {
    if (rest.length) {
      throw new Fault(404, "Endpoint not found.");
    }

    if (method !== "GET") {
      sameOrigin(request);
    }

    if (scope === "session" && !resource && method === "POST") {
      return reply(
        await authenticate(request, await input(request, v.authSchema))
      );
    }

    if (scope === "media" && resource && !item && method === "GET") {
      return await getMedia(await viewer(), uuid(resource));
    }

    if (scope === "leaderboard" && !resource && method === "GET") {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      return reply(await leaderboard(query));
    }

    if (scope === "contact" && !resource && method === "POST") {
      await limit(
        `contact:${address(request)}`,
        address(request) === "shared" ? 40 : 5,
        3600
      );

      return success(
        await newReport(await viewer(), await input(request, v.reportSchema)),
        201
      );
    }

    if (!["me", "admin", "media"].includes(scope)) {
      throw new Fault(404, "Endpoint not found.");
    }

    if (scope === "media" && resource && !item && method === "POST") {
      if (!purposes.some(p => p === resource)) {
        throw new Fault(404, "Invalid media type.");
      }

      return reply(
        await upload(request, await identity(), resource as Purpose),
        201
      );
    }

    if (scope === "me") {
      const user = await identity();

      if (method !== "GET") {
        await limit(`writes:${user.id}`, 75);
      }

      if (resource === "profile" && !item && method === "PUT") {
        await saveOwnProfile(user, await input(request, v.profileSchema));
        return success();
      }

      if (resource === "registrations" && !item && method === "POST") {
        return success(
          await applyTournament(user, await input(request, v.registrationSchema)),
          201
        );
      }

      if (resource === "registrations" && item && !action && method === "DELETE") {
        await withdraw(user, uuid(item));
        return success();
      }

      if (resource === "teams" && !item && method === "POST") {
        return success(await saveTeam(user, await input(request, v.teamSchema)), 201);
      }

      if (resource === "teams" && item && !action && method === "PUT") {
        return success(
          await saveTeam(user, await input(request, v.teamSchema), uuid(item))
        );
      }

      if (resource === "teams" && item && action === "invite" && method === "POST") {
        return success(
          await invite(
            user,
            uuid(item),
            (await input(request, v.inviteSchema)).username
          ),
          201
        );
      }

      if (resource === "teams" && item && action === "members" && method === "PATCH") {
        await manageMember(user, uuid(item), await input(request, v.teamActionSchema));
        return success();
      }

      if (resource === "invitations" && item && !action && method === "PATCH") {
        await respondInvite(
          user,
          uuid(item),
          (await input(request, v.invitationSchema)).status
        );
        return success();
      }

      if (resource === "matches" && item && action === "room" && method === "GET") {
        return reply(await roomFor(user, uuid(item)));
      }

      if (resource === "notifications" && item === "realtime" && !action && method === "GET") {
        const cfg =
          process.env.RJNX_REALTIME_ENABLED === "1"
            ? supabaseConfig()
            : null;

        if (!cfg) {
          throw new Fault(404, "Realtime is disabled.");
        }

        await limit(`inbox.ticket:${user.id}`, 18);

        const client = await supabaseServer(request);
        const { data } = await client!.auth.getSession();

        if (!data.session || data.session.user.id !== user.id) {
          throw new Fault(401, "Sign in to refresh your inbox.");
        }

        return reply({
          ...cfg,
          userId: user.id,
          token: data.session.access_token,
          expiresAt:
            data.session.expires_at ?? Math.floor(Date.now() / 1000) + 120
        });
      }

      if (resource === "notifications" && !item && method === "GET") {
        const countQuery = db
          .select({ unread: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              isNull(notifications.readAt)
            )
          );

        if (new URL(request.url).searchParams.get("summary") === "1") {
          const [{ unread }] = await countQuery;
          return reply({ unread });
        }

        const [[{ unread }], items] = await Promise.all([
          countQuery,
          db
            .select({
              id: notifications.id,
              title: notifications.title,
              body: notifications.body,
              link: notifications.link,
              readAt: notifications.readAt,
              createdAt: notifications.createdAt
            })
            .from(notifications)
            .where(eq(notifications.userId, user.id))
            .orderBy(desc(notifications.createdAt), desc(notifications.id))
            .limit(30)
        ]);

        return reply({ unread, items });
      }

      if (resource === "notifications" && item && !action && method === "PATCH") {
        await markNotice(user.id, item === "all" ? undefined : uuid(item));
        return success();
      }
    }

    if (scope === "admin") {
      const user = await identity(STAFF);

      const requireRole = (allowed: readonly Role[]) => {
        if (!can(user.role, allowed)) {
          throw new Fault(403, "You don’t have permission to do that.");
        }
      };

      if (method !== "GET") {
        await limit(`staff.writes:${user.id}`, 100);
      }

      if (!resource) {
        throw new Fault(404, "Endpoint not found.");
      }

      if (["tournaments", "registrations", "matches", "results", "games"].includes(resource)) {
        requireRole(MANAGEMENT);
      }

      if (["news", "announcements", "settings", "users"].includes(resource)) {
        requireRole(ADMIN);
      }

      if (resource === "games" && !item && method === "POST") {
        return success(await saveGame(user, await input(request, v.gameSchema)), 201);
      }

      if (resource === "tournaments" && !item && method === "POST") {
        return success(await saveTournament(user, await input(request, v.tournamentSchema)), 201);
      }

      if (resource === "tournaments" && item && !action && method === "PUT") {
        return success(
          await saveTournament(user, await input(request, v.tournamentSchema), uuid(item))
        );
      }

      if (resource === "tournaments" && item && !action && method === "DELETE") {
        await archiveTournament(user, uuid(item));
        return success();
      }

      if (resource === "registrations" && item && !action && method === "PATCH") {
        await reviewEntry(user, uuid(item), await input(request, v.reviewSchema));
        return success();
      }

      if (resource === "matches" && !item && method === "POST") {
        return success(await saveMatch(user, await input(request, v.matchSchema)), 201);
      }

      if (resource === "matches" && item && !action && method === "PUT") {
        return success(
          await saveMatch(user, await input(request, v.matchSchema), uuid(item))
        );
      }

      if (resource === "results" && item && !action && method === "PUT") {
        await submitResults(user, uuid(item), await input(request, v.matchResultSchema));
        return success();
      }

      if (resource === "results" && item && action === "publish" && method === "POST") {
        requireRole(ADMIN);
        await publishResults(user, uuid(item));
        return success();
      }

      if (resource === "users" && item && !action && method === "PATCH") {
        await changeUser(user, uuid(item), await input(request, v.userAdminSchema));
        return success();
      }

      if (resource === "teams" && item && !action && method === "PATCH") {
        requireRole(["super_admin", "admin", "moderator"]);
        await moderateTeam(
          user,
          uuid(item),
          (await input(request, z.object({ active: z.boolean() }))).active
        );
        return success();
      }

      if (resource === "news" && !item && method === "POST") {
        return success(await saveNews(user, await input(request, v.newsSchema)), 201);
      }

      if (resource === "news" && item && !action && method === "PUT") {
        return success(
          await saveNews(user, await input(request, v.newsSchema), uuid(item))
        );
      }

      if (resource === "news" && item && !action && method === "DELETE") {
        await unpublishNews(user, uuid(item));
        return success();
      }

      if (resource === "announcements" && !item && method === "POST") {
        return success(
          await saveAnnouncement(user, await input(request, v.announcementSchema)),
          201
        );
      }

      if (resource === "announcements" && item && !action && method === "PUT") {
        return success(
          await saveAnnouncement(user, await input(request, v.announcementSchema), uuid(item))
        );
      }

      if (resource === "reports" && item && !action && method === "PATCH") {
        requireRole(["super_admin", "admin", "moderator"]);
        await updateReport(user, uuid(item), await input(request, v.reportUpdateSchema));
        return success();
      }

      if (resource === "settings" && !item && method === "PUT") {
        await updateSettings(user, await input(request, v.settingsSchema));
        return success();
      }
    }

    throw new Fault(404, "Endpoint not found.");
  } catch (error) {
    return failure(error, `${method} ${scope}`);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
