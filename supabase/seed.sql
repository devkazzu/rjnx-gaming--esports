-- Local development only. Sample data has no passwords or privileged accounts.
INSERT INTO rjnx.profiles (id,username,country,bio,favorite_game,ign,experience)
VALUES ('00000000-0000-4000-9000-000000000001','nyx','India','Tactical player. Round by round.','Valorant','NYX#RX','4 years'),
('00000000-0000-4000-9000-000000000002','vortex','India','Always looking for the next clutch.','BGMI','VortexRX','3 years'),
('00000000-0000-4000-9000-000000000003','echo','Singapore','The calm before the storm.','Valorant','Echo#SG','5 years'),
('00000000-0000-4000-9000-000000000004','raven','India','In-game leader and battle royale main.','Free Fire','RavenRX','3 years'),
('00000000-0000-4000-9000-000000000005','spectre','Philippines','Playing to improve every season.','Valorant','Spectre#PH','2 years'),
('00000000-0000-4000-9000-000000000006','nova','India','Mobile esports and team strategies.','BGMI','NovaRX','4 years') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.teams (id,name,slug,tag,description) VALUES
('00000000-0000-4000-9001-000000000001','Phantom Core','phantom-core','PHC','Tactical discipline, clean rotations, and a squad built to compete.'),
('00000000-0000-4000-9001-000000000002','Neon Syndicate','neon-syndicate','NEON','A cross-region roster with a playstyle built around pressure.'),
('00000000-0000-4000-9001-000000000003','Crimson Unit','crimson-unit','CRU','Mobile competitors who thrive when the circle closes.') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.team_members(team_id,user_id,role) VALUES
('00000000-0000-4000-9001-000000000001','00000000-0000-4000-9000-000000000001','captain'),('00000000-0000-4000-9001-000000000001','00000000-0000-4000-9000-000000000005','member'),
('00000000-0000-4000-9001-000000000002','00000000-0000-4000-9000-000000000003','captain'),('00000000-0000-4000-9001-000000000002','00000000-0000-4000-9000-000000000004','member'),
('00000000-0000-4000-9001-000000000003','00000000-0000-4000-9000-000000000002','captain'),('00000000-0000-4000-9001-000000000003','00000000-0000-4000-9000-000000000006','member') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.tournaments(id,title,slug,game_id,description,rules,format,mode,squad_size,status,season,prize,platform,capacity,featured,reg_start,reg_end,starts_at,ends_at)
SELECT v.id::uuid,v.title,v.slug,g.id,v.description,'Check in before your scheduled match. Use the in-game name on your entry. Keep room details private and follow staff instructions. Exploits, smurfing and harassment result in disqualification.',v.format,v.mode,v.size,v.status::rjnx.tournament_status,'Season 01',v.prize,v.platform,v.capacity,v.featured,now()+v.a*interval '1 day',now()+v.b*interval '1 day',now()+v.c*interval '1 day',now()+v.d*interval '1 day'
FROM (VALUES
('00000000-0000-4000-9002-000000000001','Valorant Champions Cup','valorant-champions-cup','valorant','Lock your agents and take the stage. Five-player rosters compete through a single-elimination bracket, where clean comms and smart utility make the difference.','Single Elimination','squad',5,'open','₹50,000','PC',32,true,-9,8,11,13),
('00000000-0000-4000-9002-000000000002','BGMI Survival Series','bgmi-survival-series','bgmi','Land together, hold the zone and outlast the lobby. Take your four-player squad through a tactical battle royale series with placement and elimination points.','Battle Royale','squad',4,'ongoing','₹30,000','Mobile',25,true,-16,-5,-3,6),
('00000000-0000-4000-9002-000000000003','Free Fire Showdown','free-fire-showdown','free-fire','Bring a duo for a fast-paced Free Fire series. Every placement matters and each elimination moves you up the standings.','Battle Royale','duo',2,'upcoming','₹20,000','Mobile',48,true,2,13,16,19),
('00000000-0000-4000-9002-000000000004','Arena Trials: First Strike','arena-trials-first-strike','valorant','The first RJNX solo trials. A short tactical competition to put new contenders on the scoreboard.','Points Based','solo',1,'completed','Community cup','PC',16,false,-36,-30,-28,-25)
) v(id,title,slug,game,description,format,mode,size,status,prize,platform,capacity,featured,a,b,c,d) JOIN rjnx.games g ON g.slug=v.game ON CONFLICT DO NOTHING;
INSERT INTO rjnx.scoring_rules (tournament_id,placements,kill_points,win_points) SELECT id,'{"1":15,"2":10,"3":8,"4":6,"5":4}',1,0 FROM rjnx.tournaments WHERE id::text LIKE '00000000-0000-4000-9002-%' ON CONFLICT DO NOTHING;
INSERT INTO rjnx.tournament_registrations(id,tournament_id,applicant_id,status) VALUES
('00000000-0000-4000-9003-000000000001','00000000-0000-4000-9002-000000000004','00000000-0000-4000-9000-000000000001','approved'),
('00000000-0000-4000-9003-000000000002','00000000-0000-4000-9002-000000000004','00000000-0000-4000-9000-000000000003','approved'),
('00000000-0000-4000-9003-000000000003','00000000-0000-4000-9002-000000000004','00000000-0000-4000-9000-000000000005','approved') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.registration_members(registration_id,user_id,ign) SELECT r.id,p.id,p.ign FROM rjnx.tournament_registrations r JOIN rjnx.profiles p ON p.id=r.applicant_id WHERE r.id::text LIKE '00000000-0000-4000-9003-%' ON CONFLICT DO NOTHING;
INSERT INTO rjnx.matches(id,tournament_id,title,number,round,scheduled_at,status,published_at) VALUES ('00000000-0000-4000-9004-000000000001','00000000-0000-4000-9002-000000000004','First Strike Finals',1,'Final',now()-interval '27 days','completed',now()-interval '26 days') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.match_participants(match_id,registration_id) SELECT '00000000-0000-4000-9004-000000000001',id FROM rjnx.tournament_registrations WHERE id::text LIKE '00000000-0000-4000-9003-%' ON CONFLICT DO NOTHING;
INSERT INTO rjnx.match_results (match_id,registration_id,position,kills,points,verified_at)
VALUES ('00000000-0000-4000-9004-000000000001','00000000-0000-4000-9003-000000000001',1,19,34,now()-interval '26 days'),
('00000000-0000-4000-9004-000000000001','00000000-0000-4000-9003-000000000002',2,14,24,now()-interval '26 days'),
('00000000-0000-4000-9004-000000000001','00000000-0000-4000-9003-000000000003',3,11,19,now()-interval '26 days') ON CONFLICT DO NOTHING;
INSERT INTO rjnx.news_articles (slug,title,summary,content,category,tags,published_at) VALUES
('welcome-to-the-rjnx-arena','Welcome to the RJNX Arena','A new home for the competitive gaming community opens its doors.','An arena is only as good as the people who play in it. RJNX brings together aspiring and experienced players to compete in free-entry tournaments, build teams and climb verified rankings.\n\nStart by finding an event, reading its rules and completing your player profile. The arena is yours to make.','Community','["arena", "launch"]',now()-interval '4 days'),
('inside-the-champions-cup','Inside the Champions Cup','The format, roster requirements and match-day expectations for our Valorant flagship.','The Champions Cup rewards coordinated five-player rosters. Captains should confirm their team line-up before submitting an entry and verify in-game names before check-in.\n\nMatch schedules and private room details will appear on participants’ dashboards.','Tournaments','["valorant", "rules"]',now()-interval '2 days') ON CONFLICT DO NOTHING;
