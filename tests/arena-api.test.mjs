import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseURL, connection, fx, json, png } from './harness.mjs';

await test('RJNX live database and API workflows', {skip:!connection,timeout:75000},async t=>{
  const f=await fx();t.after(()=>f.cleanup());
  const [staff,manager,moderator,a,b,c,d]=await Promise.all([f.login('operator','super_admin'),f.login('manager','manager'),f.login('mod','moderator'),f.login('alpha'),f.login('bravo'),f.login('charlie'),f.login('delta')]);
  const guest=await f.client();
  let squad,solo,duo,match,photo,proof,r1,r2;
  const entry=(ev,owner,teamId=null,additional=[])=>({tournamentId:ev.id,teamId,rulesAccepted:true,players:[{id:owner.id,ign:`${owner.username} RX`},...additional],note:'QA entry.'});

  await t.test('authentication, duplicate identity, server protection, and origin enforcement',async()=>{
    assert.deepEqual(await json(await guest.get('/api/health'),200),{ok:true});
    for(const route of ['/dashboard','/dashboard/profile','/admin','/admin/users'])assert.match((await guest.get(route,{maxRedirects:0})).headers().location,/\/login/);
    assert.match((await a.api.get('/admin',{maxRedirects:0})).headers().location,/\/dashboard\?notice=restricted/);
    const duplicate=await guest.post('/api/session',{data:{action:'register',...a,api:undefined}});await json(duplicate,409);
    await json(await guest.post('/api/session',{data:{action:'login',email:a.email,password:'invalid'}}),401);
    const logged=await guest.post('/api/session',{data:{action:'login',email:a.email,password:a.password}});
    assert.match(logged.headers()['set-cookie'],/HttpOnly/i);await json(logged,200);
    await json(await guest.post('/api/session',{data:{action:'logout'}}),200);
    await json(await guest.get('/api/me/notifications'),401);
    const cross=await a.api.put('/api/me/profile',{headers:{origin:'https://foreign.invalid'},data:{}});await json(cross,403);
    await json(await a.api.post('/api/admin/tournaments',{data:{}}),403);
    await json(await manager.api.patch(`/api/admin/users/${a.id}`,{data:{}}),403);
    await json(await moderator.api.post('/api/admin/matches',{data:{}}),403);
  });

  await t.test('profile changes, validated image upload and ownership',async()=>{
    await json(await a.api.post('/api/media/avatar',{headers:{'content-type':'image/png'},data:Buffer.from('not a PNG')}),422);
    ({id:photo}=await json(await a.api.post('/api/media/avatar',{headers:{'content-type':'image/png'},data:png}),201));
    await json(await b.api.get(`/api/media/${photo}`),404);
    const profile={username:a.username,fullName:'Arena Alpha',country:'India',bio:'Verified test player.',favoriteGame:'Valorant',ign:'ArenaAlpha',experience:'Five years',avatarId:photo};
    await json(await b.api.put('/api/me/profile',{data:{...profile,username:b.username}}),422);
    await json(await a.api.put('/api/me/profile',{data:profile}),200);
    const image=await guest.get(`/api/media/${photo}`);assert.equal(image.status(),200);assert.equal(image.headers()['content-type'],'image/webp');
    assert.match(await (await guest.get(`/players/${a.username}`)).text(),/Arena Alpha/);
    await json(await a.api.put('/api/me/profile',{data:{...profile,username:b.username}}),409);
  });

  await t.test('team creation, invitation authorization, acceptance, and role changes',async()=>{
    ({id:squad}=await json(await a.api.post('/api/me/teams',{data:{name:`${f.prefix} roster`,tag:f.tag.slice(0,6).toUpperCase(),description:'A roster enrolled through the live app.',logoId:null}}),201));f.d.teams.push(squad);
    await json(await c.api.post(`/api/me/teams/${squad}/invite`,{data:{username:b.username}}),403);
    const {id:invite}=await json(await a.api.post(`/api/me/teams/${squad}/invite`,{data:{username:b.username}}),201);
    await json(await c.api.patch(`/api/me/invitations/${invite}`,{data:{status:'accepted'}}),404);
    await json(await b.api.patch(`/api/me/invitations/${invite}`,{data:{status:'accepted'}}),200);
    await json(await b.api.patch(`/api/me/invitations/${invite}`,{data:{status:'accepted'}}),409);
    await json(await a.api.patch(`/api/me/teams/${squad}/members`,{data:{action:'co_captain',userId:b.id}}),200);
    assert.match(await (await a.api.get('/dashboard/my-team')).text(),new RegExp(b.username));
  });

  await t.test('event creation, roster validation, duplicate protection and capacity',async()=>{
    solo=await f.event(manager.api,'solo bracket');duo=await f.event(staff.api,'duo trials',{mode:'duo',squadSize:2,format:'Battle Royale'});
    const embargo=await f.event(staff.api,'draft event',{status:'draft'});
    assert.equal((await guest.get(`/tournaments/${embargo.slug}`)).status(),404);
    await json(await a.api.post('/api/me/registrations',{data:entry(embargo,a)}),409);
    const expired=await f.event(staff.api,'expired event',{regStart:new Date(Date.now()-7200_000).toISOString(),regEnd:new Date(Date.now()-3600_000).toISOString()});
    await json(await a.api.post('/api/me/registrations',{data:entry(expired,a)}),409);
    await json(await a.api.post('/api/me/registrations',{data:entry(duo,a,squad,[{id:c.id,ign:'Not my teammate'}])}),422);
    await json(await a.api.post('/api/me/registrations',{data:entry(duo,a,squad,[{id:b.id,ign:'BravoRX'}])}),201);
    await json(await b.api.post('/api/me/registrations',{data:entry(duo,b,squad,[{id:a.id,ign:'AlphaRX'}])}),409);
    ({id:r1}=await json(await a.api.post('/api/me/registrations',{data:entry(solo,a)}),201));
    await json(await a.api.post('/api/me/registrations',{data:entry(solo,a)}),409);
    const racing=[c,d];const replies=await Promise.all(racing.map(p=>p.api.post('/api/me/registrations',{data:entry(solo,p)})));
    assert.deepEqual(replies.map(x=>x.status()).sort(),[201,409]);
    const win=replies.findIndex(x=>x.status()===201);r2=(await replies[win].json()).id;
    for (const id of [r1,r2])await json(await manager.api.patch(`/api/admin/registrations/${id}`,{data:{status:'approved',reviewNote:'Roster verified.'}}),200);
    assert.match(await (await a.api.get('/dashboard/my-tournaments')).text(),/Approved/);
    await json(await a.api.post('/api/me/registrations',{data:{...entry(solo,a),rulesAccepted:false}}),422);
  });

  await t.test('scheduled match room stays private and assignment blocks withdrawal',async()=>{
    const draft={tournamentId:solo.id,title:'QA Arena final',number:1,round:'Final',scheduledAt:solo.startsAt,status:'scheduled',instructions:'Check in early.',roomId:'ROOM-QA',password:'QAPrivate-Arena',released:true,entries:[r1,r2]};
    ({id:match}=await json(await manager.api.post('/api/admin/matches',{data:draft}),201));
    const room=`/api/me/matches/${match}/room`;
    assert.equal((await json(await a.api.get(room),200)).password,draft.password);
    await json(await b.api.get(room),404);
    await json(await guest.get(room),401);
    assert.equal((await json(await staff.api.get(room),200)).roomId,draft.roomId);
    assert.ok(!(await (await guest.get(`/tournaments/${solo.slug}`)).text()).includes(draft.password));
    assert.ok(!(await (await a.api.get('/dashboard/matches')).text()).includes(draft.password));
    await json(await a.api.delete(`/api/me/registrations/${r1}`),409);
    await json(await a.api.delete(`/api/me/registrations/${r2}`),403);
  });

  await t.test('proof, result verification, deterministic standings, and revisions',async()=>{
    ({id:proof}=await json(await manager.api.post('/api/media/proof',{headers:{'content-type':'image/png'},data:png}),201));
    await json(await a.api.get(`/api/media/${proof}`),404);
    assert.equal((await staff.api.get(`/api/media/${proof}`)).status(),200);
    const scores={entries:[{registrationId:r1,position:1,kills:8,bonus:5,penalty:1,proofId:proof},{registrationId:r2,position:2,kills:9,bonus:0,penalty:0,proofId:null}]};
    const board=`/api/leaderboard?tournament=${solo.slug}`;
    const publish=`/api/admin/results/${match}/publish`;
    await json(await manager.api.put(`/api/admin/results/${match}`,{data:{entries:[scores.entries[0],{...scores.entries[1],position:1}]}}),422);
    await json(await manager.api.put(`/api/admin/results/${match}`,{data:scores}),200);
    assert.equal((await json(await guest.get(board),200)).rows.length,0);
    await json(await manager.api.post(publish),403);
    await json(await staff.api.post(publish),200);
    const ranking=(await json(await guest.get(board),200)).rows;
    assert.equal(ranking.length,2);assert.equal(ranking[0].name,a.username);assert.equal(ranking[0].points,38);assert.equal(ranking[0].rank,1);assert.equal(ranking[1].points,26);
    assert.equal((await json(await guest.get(`${board}&q=${a.username}`),200)).rows[0].rank,1);
    assert.equal((await json(await guest.get(`${board}&type=teams`),200)).rows.length,0);
    await json(await a.api.get(`/api/me/matches/${match}/room`),404);
    await json(await manager.api.put(`/api/admin/results/${match}`,{data:scores}),403);
    await json(await staff.api.put(`/api/admin/results/${match}`,{data:scores}),200);
    assert.equal((await json(await guest.get(board),200)).rows.length,0);
    await json(await staff.api.post(publish),200);
    const history=await f.db.execute(f.sql`select count(*)::int n from rjnx.result_history where match_id=${match}`);assert.equal(history.rows[0].n,5);
    const beyond=await json(await guest.get(`${board}&page=50`),200);assert.equal(beyond.total,2);assert.deepEqual(beyond.rows,[]);
    const tied={entries:[{registrationId:r1,position:1,kills:0,bonus:0,penalty:0,proofId:proof},{registrationId:r2,position:2,kills:5,bonus:0,penalty:0,proofId:null}]};
    await json(await staff.api.put(`/api/admin/results/${match}`,{data:tied}),200);
    await json(await staff.api.post(publish),200);
    const ordered=(await json(await guest.get(board),200)).rows;
    assert.equal(ordered[0].points,ordered[1].points);assert.equal(ordered[0].name,a.username);assert.equal(ordered[0].wins,1);
  });

  await t.test('news publishing, tournament-scoped notices, reports and staff moderation',async()=>{
    const article={title:`${f.prefix} featured article`,slug:`qa-${f.tag}-article`,summary:'A headline for the community.',content:'This article is published through the staff CMS and read from the live database.',category:'QA',tags:['qa','esports'],imageId:null,publishedAt:null};
    const {id:doc}=await json(await staff.api.post('/api/admin/news',{data:article}),201);f.d.articles.push(doc);
    assert.equal((await guest.get(`/news/${article.slug}`)).status(),404);
    await json(await staff.api.put(`/api/admin/news/${doc}`,{data:{...article,publishedAt:new Date(Date.now()-1000).toISOString()}}),200);
    assert.match(await (await guest.get(`/news/${article.slug}`)).text(),/live database/);
    const {id:message}=await json(await staff.api.post('/api/admin/announcements',{data:{title:`${f.prefix} stage notice`,body:'A scheduled match has an arena notice.',tournamentId:solo.id,send:true}}),201);f.d.announcements.push(message);
    assert.ok((await json(await a.api.get('/api/me/notifications'),200)).items.some(x=>x.title.includes('stage notice')));
    assert.ok(!(await json(await b.api.get('/api/me/notifications'),200)).items.some(x=>x.title.includes('stage notice')));
    await json(await a.api.patch('/api/me/notifications/all'),200);assert.equal((await json(await a.api.get('/api/me/notifications'),200)).unread,0);
    const {id:report}=await json(await guest.post('/api/contact',{data:{email:a.email,subject:`${f.prefix} support`,body:'Please inspect this tournament support request.'}}),201);f.d.reports.push(report);
    await json(await moderator.api.patch(`/api/admin/reports/${report}`,{data:{status:'resolved',response:'Handled at the moderation desk.'}}),200);
    await json(await moderator.api.patch(`/api/admin/teams/${squad}`,{data:{active:false}}),200);
    await json(await moderator.api.patch(`/api/admin/teams/${squad}`,{data:{active:true}}),200);
    await json(await staff.api.patch(`/api/admin/users/${d.id}`,{data:{fullName:'Delta',country:'India',suspended:true,role:'player'}}),200);
    await json(await d.api.get('/api/me/notifications'),401);
    await json(await staff.api.patch(`/api/admin/users/${d.id}`,{data:{fullName:'Delta',country:'India',suspended:false,role:'player'}}),200);
    await json(await staff.api.patch(`/api/admin/users/${d.id}`,{data:{fullName:'Delta',country:'India',suspended:false,role:'moderator'}}),200);
    await json(await staff.api.patch(`/api/admin/users/${staff.id}`,{data:{fullName:'Owner',country:'India',suspended:false,role:'player'}}),403);
    assert.match(await (await staff.api.get('/admin/audit-logs')).text(),/user.update/);
    const summary=await json(await a.api.get('/api/me/notifications?summary=1'),200);assert.equal(typeof summary.unread,'number');assert.ok(!('items' in summary));
  });
  await t.test('homepage banner and FAQ configuration publish only approved media',async()=>{
    const [previous]=(await f.db.execute(f.sql`select value from rjnx.platform_settings where key='site'`)).rows;
    const invalidation=await a.api.get('/api/me/notifications/realtime');await json(invalidation,404);
    await json(await b.api.post('/api/media/site',{headers:{'content-type':'image/png'},data:png}),403);
    const {id:banner}=await json(await staff.api.post('/api/media/site',{headers:{'content-type':'image/png'},data:png}),201);
    await json(await guest.get(`/api/media/${banner}`),404);
    const payload={heroId:banner,tagline:'TEST. COMPETE. WIN.',homepageNote:'This temporary configuration was updated by an authorized staff account.',communityUrl:'',faqs:[{q:'What is this test?',a:'An arena test for editable platform information.'}]};
    try {
      await json(await manager.api.put('/api/admin/settings',{data:payload}),403);
      await json(await staff.api.put('/api/admin/settings',{data:payload}),200);
      assert.equal((await guest.get(`/api/media/${banner}`)).status(),200);
      assert.match(await (await guest.get('/faq')).text(),/What is this test/);
    } finally {
      if(previous)await f.db.execute(f.sql`update rjnx.platform_settings set value=${JSON.stringify(previous.value)}::jsonb where key='site'`);
      else await f.db.execute(f.sql`delete from rjnx.platform_settings where key='site'`);
    }
    await json(await guest.get(`/api/media/${banner}`),404);
  });
  assert.ok(baseURL.startsWith('http'));
});
