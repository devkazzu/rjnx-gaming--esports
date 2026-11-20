CREATE SCHEMA "rjnx";
--> statement-breakpoint
CREATE TYPE "rjnx"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "rjnx"."match_status" AS ENUM('scheduled', 'live', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "rjnx"."registration_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "rjnx"."staff_role" AS ENUM('super_admin', 'admin', 'manager', 'moderator', 'player');--> statement-breakpoint
CREATE TYPE "rjnx"."team_role" AS ENUM('captain', 'co_captain', 'member');--> statement-breakpoint
CREATE TYPE "rjnx"."tournament_status" AS ENUM('draft', 'upcoming', 'open', 'closed', 'ongoing', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TABLE "rjnx"."local_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "local_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"tournament_id" uuid,
	"sent_at" timestamp with time zone,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(70) NOT NULL,
	"target" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(80) NOT NULL,
	"artwork" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug"),
	CONSTRAINT "games_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent_by" uuid,
	"status" "rjnx"."invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."match_participants" (
	"match_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	CONSTRAINT "match_participants_match_id_registration_id_pk" PRIMARY KEY("match_id","registration_id")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kills" integer DEFAULT 0 NOT NULL,
	"bonus" integer DEFAULT 0 NOT NULL,
	"penalty" integer DEFAULT 0 NOT NULL,
	"points" integer NOT NULL,
	"proof_id" uuid,
	"submitted_by" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "one_result_per_participant" UNIQUE("match_id","registration_id"),
	CONSTRAINT "result_range" CHECK ("rjnx"."match_results"."position" between 1 and 512 and "rjnx"."match_results"."kills" between 0 and 999 and "rjnx"."match_results"."bonus">=0 and "rjnx"."match_results"."penalty">=0)
);
--> statement-breakpoint
CREATE TABLE "rjnx"."match_rooms" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"room_id" varchar(100) DEFAULT '' NOT NULL,
	"password" varchar(100) DEFAULT '' NOT NULL,
	"released" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"number" integer NOT NULL,
	"round" varchar(50) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "rjnx"."match_status" DEFAULT 'scheduled' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_number_event" UNIQUE("tournament_id","number"),
	CONSTRAINT "match_number_valid" CHECK ("rjnx"."matches"."number">0)
);
--> statement-breakpoint
CREATE TABLE "rjnx"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader" uuid,
	"purpose" varchar(20) NOT NULL,
	"mime" varchar(30) NOT NULL,
	"size" integer NOT NULL,
	"path" text,
	"data" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_size" CHECK ("rjnx"."media"."size" between 1 and 3145728),
	CONSTRAINT "media_backend" CHECK (("rjnx"."media"."path" is null) <> ("rjnx"."media"."data" is null))
);
--> statement-breakpoint
CREATE TABLE "rjnx"."news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(90) NOT NULL,
	"title" varchar(125) NOT NULL,
	"summary" varchar(280) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_id" uuid,
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(130) NOT NULL,
	"body" text NOT NULL,
	"link" varchar(200) NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(24) NOT NULL,
	"full_name" varchar(80) DEFAULT '' NOT NULL,
	"avatar_id" uuid,
	"country" varchar(60) DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"favorite_game" varchar(60) DEFAULT '' NOT NULL,
	"ign" varchar(64) DEFAULT '' NOT NULL,
	"experience" varchar(50) DEFAULT '' NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "profile_username" CHECK ("rjnx"."profiles"."username" ~ '^[a-z0-9_]{3,24}$')
);
--> statement-breakpoint
CREATE TABLE "rjnx"."rate_limits" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"window" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."registration_members" (
	"registration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ign" varchar(64) NOT NULL,
	CONSTRAINT "registration_members_registration_id_user_id_pk" PRIMARY KEY("registration_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"team_id" uuid,
	"status" "rjnx"."registration_status" DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(254) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(18) DEFAULT 'open' NOT NULL,
	"response" text DEFAULT '' NOT NULL,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_state" CHECK ("rjnx"."reports"."status" in ('open','reviewing','resolved'))
);
--> statement-breakpoint
CREATE TABLE "rjnx"."result_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(30) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."scoring_rules" (
	"tournament_id" uuid PRIMARY KEY NOT NULL,
	"placements" jsonb NOT NULL,
	"kill_points" integer DEFAULT 1 NOT NULL,
	"win_points" integer DEFAULT 0 NOT NULL,
	"bonus_max" integer DEFAULT 100 NOT NULL,
	"penalty_max" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_range" CHECK ("rjnx"."scoring_rules"."kill_points" between 0 and 100 and "rjnx"."scoring_rules"."win_points" between 0 and 100 and "rjnx"."scoring_rules"."bonus_max" between 0 and 1000 and "rjnx"."scoring_rules"."penalty_max" between 0 and 1000)
);
--> statement-breakpoint
CREATE TABLE "rjnx"."local_sessions" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."platform_settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rjnx"."team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "rjnx"."team_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "rjnx"."teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(70) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"tag" varchar(6) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug"),
	CONSTRAINT "teams_tag_unique" UNIQUE("tag"),
	CONSTRAINT "team_tag" CHECK ("rjnx"."teams"."tag" ~ '^[A-Z0-9]{2,6}$')
);
--> statement-breakpoint
CREATE TABLE "rjnx"."tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(100) NOT NULL,
	"slug" varchar(90) NOT NULL,
	"game_id" uuid NOT NULL,
	"description" text NOT NULL,
	"rules" text NOT NULL,
	"banner_id" uuid,
	"logo_id" uuid,
	"format" varchar(32) NOT NULL,
	"mode" varchar(10) NOT NULL,
	"squad_size" integer NOT NULL,
	"status" "rjnx"."tournament_status" DEFAULT 'draft' NOT NULL,
	"season" varchar(40) NOT NULL,
	"prize" varchar(100) DEFAULT '' NOT NULL,
	"platform" varchar(20) DEFAULT 'Cross-platform' NOT NULL,
	"capacity" integer NOT NULL,
	"reg_start" timestamp with time zone NOT NULL,
	"reg_end" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tournament_dates" CHECK ("rjnx"."tournaments"."reg_start" < "rjnx"."tournaments"."reg_end" and "rjnx"."tournaments"."reg_end" <= "rjnx"."tournaments"."starts_at" and "rjnx"."tournaments"."starts_at" < "rjnx"."tournaments"."ends_at"),
	CONSTRAINT "tournament_capacity" CHECK ("rjnx"."tournaments"."capacity" between 2 and 512),
	CONSTRAINT "tournament_mode" CHECK (("rjnx"."tournaments"."mode"='solo' and "rjnx"."tournaments"."squad_size"=1) or ("rjnx"."tournaments"."mode"='duo' and "rjnx"."tournaments"."squad_size"=2) or ("rjnx"."tournaments"."mode"='squad' and "rjnx"."tournaments"."squad_size" between 3 and 8))
);
--> statement-breakpoint
CREATE TABLE "rjnx"."user_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "rjnx"."staff_role" DEFAULT 'player' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rjnx"."local_accounts" ADD CONSTRAINT "local_accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."announcements" ADD CONSTRAINT "announcements_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "rjnx"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."announcements" ADD CONSTRAINT "announcements_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "rjnx"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."team_invitations" ADD CONSTRAINT "team_invitations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."team_invitations" ADD CONSTRAINT "team_invitations_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "rjnx"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_participants" ADD CONSTRAINT "match_participants_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "rjnx"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "rjnx"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_results" ADD CONSTRAINT "match_results_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "rjnx"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_results" ADD CONSTRAINT "match_results_proof_id_media_id_fk" FOREIGN KEY ("proof_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_results" ADD CONSTRAINT "match_results_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_results" ADD CONSTRAINT "match_results_verified_by_profiles_id_fk" FOREIGN KEY ("verified_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."match_rooms" ADD CONSTRAINT "match_rooms_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "rjnx"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "rjnx"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."matches" ADD CONSTRAINT "matches_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."news_articles" ADD CONSTRAINT "news_articles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."news_articles" ADD CONSTRAINT "news_articles_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."profiles" ADD CONSTRAINT "profiles_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."registration_members" ADD CONSTRAINT "registration_members_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "rjnx"."tournament_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."registration_members" ADD CONSTRAINT "registration_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "rjnx"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournament_registrations" ADD CONSTRAINT "tournament_registrations_applicant_id_profiles_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "rjnx"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournament_registrations" ADD CONSTRAINT "tournament_registrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "rjnx"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournament_registrations" ADD CONSTRAINT "tournament_registrations_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."reports" ADD CONSTRAINT "reports_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."reports" ADD CONSTRAINT "reports_handled_by_profiles_id_fk" FOREIGN KEY ("handled_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."result_history" ADD CONSTRAINT "result_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "rjnx"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."result_history" ADD CONSTRAINT "result_history_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."scoring_rules" ADD CONSTRAINT "scoring_rules_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "rjnx"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."local_sessions" ADD CONSTRAINT "local_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "rjnx"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."team_members" ADD CONSTRAINT "team_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."teams" ADD CONSTRAINT "teams_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournaments" ADD CONSTRAINT "tournaments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "rjnx"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournaments" ADD CONSTRAINT "tournaments_banner_id_media_id_fk" FOREIGN KEY ("banner_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournaments" ADD CONSTRAINT "tournaments_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "rjnx"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."tournaments" ADD CONSTRAINT "tournaments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "rjnx"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rjnx"."user_roles" ADD CONSTRAINT "user_roles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "rjnx"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "rjnx"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "rjnx"."audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_pending_invite_idx" ON "rjnx"."team_invitations" USING btree ("team_id","user_id") WHERE "rjnx"."team_invitations"."status"='pending';--> statement-breakpoint
CREATE INDEX "team_invited_user_idx" ON "rjnx"."team_invitations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "participant_registration_idx" ON "rjnx"."match_participants" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "result_registration_idx" ON "rjnx"."match_results" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "match_schedule_idx" ON "rjnx"."matches" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "media_uploader_idx" ON "rjnx"."media" USING btree ("uploader","created_at");--> statement-breakpoint
CREATE INDEX "news_publication_idx" ON "rjnx"."news_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "notifications_owner_date_idx" ON "rjnx"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "rjnx"."notifications" USING btree ("user_id") WHERE "rjnx"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "profiles_active_idx" ON "rjnx"."profiles" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "rate_window_idx" ON "rjnx"."rate_limits" USING btree ("window");--> statement-breakpoint
CREATE INDEX "registration_member_idx" ON "rjnx"."registration_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registration_event_idx" ON "rjnx"."tournament_registrations" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "registration_applicant_idx" ON "rjnx"."tournament_registrations" USING btree ("applicant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_solo_entry_idx" ON "rjnx"."tournament_registrations" USING btree ("tournament_id","applicant_id") WHERE "rjnx"."tournament_registrations"."team_id" is null and "rjnx"."tournament_registrations"."status" in ('pending','approved');--> statement-breakpoint
CREATE UNIQUE INDEX "active_team_entry_idx" ON "rjnx"."tournament_registrations" USING btree ("tournament_id","team_id") WHERE "rjnx"."tournament_registrations"."status" in ('pending','approved');--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "rjnx"."reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "result_history_match_idx" ON "rjnx"."result_history" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "rjnx"."local_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "rjnx"."local_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_one_captain_idx" ON "rjnx"."team_members" USING btree ("team_id") WHERE "rjnx"."team_members"."role"='captain';--> statement-breakpoint
CREATE INDEX "tournament_status_start_idx" ON "rjnx"."tournaments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "tournament_game_idx" ON "rjnx"."tournaments" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "roles_idx" ON "rjnx"."user_roles" USING btree ("role");