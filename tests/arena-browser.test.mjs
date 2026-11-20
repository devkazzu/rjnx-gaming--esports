import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { baseURL, connection, fx, json } from './harness.mjs';

const snap=process.env.SCREENSHOT_DIR;
const waits={timeout:9000};
async function fit(page,width){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`No horizontal overflow at ${width}px (${page.url()})`);}
await test('RJNX browser: public routes, responsive navigation, and actual player/administrator workflows', {skip:!connection,timeout:110000},async t=>{
 const f=await fx();const browser=await chromium.launch();t.after(async()=>{await browser.close();await f.cleanup();});
 const pc=await browser.newContext({baseURL,viewport:{width:1440,height:950}});
 const page=await pc.newPage();page.setDefaultTimeout(9000);
 const problems=[];page.on('pageerror',e=>problems.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/^Failed to load resource:.*404/.test(m.text()))problems.push(m.text());});
 let operator,created,entrant,match,admin;

 await t.test('public home and content routes at all requested sizes',async()=>{
  await page.goto('/');await page.getByRole('heading',{name:/ENTER THE ARENA/}).waitFor(waits);
  await page.locator('.hero-art').evaluate(el=>el.decode());
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.featured img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  if(snap)await page.screenshot({path:`${snap}/rjnx-desktop.png`,animations:'disabled'});
  for(const w of [360,390,768,1024,1440])await fit(page,w);
  for(const path of ['/tournaments','/leaderboard','/teams','/players','/news','/about','/rules','/contact','/faq','/privacy-policy','/terms','/login','/register','/forgot-password']){
    const res=await page.goto(path);assert.equal(res.status(),200,path);await page.locator('h1').first().waitFor(waits);await fit(page,360);
  }
  await page.goto('/');await fit(page,390);
  if(snap)await page.screenshot({path:`${snap}/rjnx-mobile.png`,animations:'disabled'});
  const trigger=page.getByRole('button',{name:'Open navigation'});
  await trigger.click();await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Tournaments',exact:true}).click();
  await page.getByRole('heading',{name:'Tournaments',exact:true}).waitFor();
  await page.getByLabel('All games').selectOption('valorant');
  await page.getByRole('button',{name:'Apply filters'}).click();
  await page.waitForURL(/game=valorant/);
  assert.equal(await page.getByText('BGMI Survival Series',{exact:true}).count(),0);
 });

 await t.test('create an account in the UI, edit profile, and verify private navigation',async()=>{
  const account=f.names('browser');
  await page.goto('/register');
  await page.getByLabel('Email address').fill(account.email);await page.getByLabel('Player handle').fill(account.username);await page.getByLabel('Password',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByRole('heading',{name:`Welcome, ${account.username}.`,exact:true}).waitFor();
  entrant=await f.idByName(account.username);
  await fit(page,390);await page.getByRole('button',{name:'Player menu'}).click();
  await page.getByRole('navigation',{name:'Player menu'}).getByRole('link',{name:'My profile',exact:true}).click();
  await page.getByLabel('In-game username').fill('UI-competitor');await page.getByLabel('Profile bio').fill('Updated through the player dashboard.');
  await page.getByRole('button',{name:'Save player profile'}).click();await page.getByText('Saved successfully.',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Public profile',exact:true}).click();
  await page.getByText('Updated through the player dashboard.',{exact:true}).waitFor();
  await page.goto('/admin');await page.getByText('This account doesn’t have staff access.').waitFor();
 });

 await t.test('staff can create an event with the full form',async()=>{
  await fit(page,1440);
  operator=await f.login('staff','admin');
  const staffContext=await browser.newContext({baseURL,storageState:await operator.api.storageState()});
  admin=await staffContext.newPage();admin.setDefaultTimeout(9000);admin.on('pageerror',e=>problems.push(e.message));
  await admin.goto('/admin');await admin.getByRole('heading',{name:'Control center'}).waitFor();
  await admin.getByRole('navigation',{name:'Admin menu'}).getByRole('link',{name:'Tournaments',exact:true}).waitFor();
  for(const path of ['users','tournaments','registrations','matches','results','teams','leaderboard','news','announcements','reports','settings','audit-logs']){
    const res=await admin.goto(`/admin/${path}`);assert.equal(res.status(),200,path);await admin.locator('h1').first().waitFor(waits);assert.ok(!(await admin.locator('body').innerText()).includes('Connection to the arena interrupted'));
  }
  await admin.goto('/admin/tournaments?create=1');
  const title=`${f.prefix} UI Arena`, slug=`qa-${f.tag}-ui-arena`;
  await admin.getByLabel('Tournament title').fill(title);await admin.getByLabel('URL slug').fill(slug);await admin.getByRole('combobox',{name:'Game',exact:true}).selectOption(await f.game());await admin.getByRole('combobox',{name:'Tournament status',exact:true}).selectOption('open');
  await admin.getByLabel('Event description').fill('A real competition created and tested through the admin editor.');
  await admin.getByLabel('Tournament rules').fill('Play fairly, arrive on time, and keep credentials private.');
  await admin.getByRole('button',{name:'Create tournament',exact:true}).click();
  await admin.waitForURL(p=>p.pathname==='/admin/tournaments'&&!p.search);
  const [row]=(await f.db.execute(f.sql`select id,starts_at from rjnx.tournaments where slug=${slug}`)).rows;assert.ok(row?.id);created={...row,slug,title};f.d.events.push(row.id);
  await admin.getByRole('row',{name:new RegExp(title)}).waitFor();
  if(snap)await admin.screenshot({path:`${snap}/rjnx-admin.png`,animations:'disabled'});
 });

 await t.test('player enters, sees approval, reveals assigned room, and reads published results',async()=>{
  const event=created;
  await page.goto(`/tournaments/${event.slug}`);
  await page.getByRole('heading',{name:new RegExp(event.title,'i')}).waitFor();
  assert.equal(await page.getByLabel('In-game username').inputValue(),'UI-competitor');
  await page.getByLabel(/I have read and agree/).check();
  await page.getByRole('button',{name:'Submit registration'}).click();
  await page.getByText('You already have an active entry.').waitFor();
  const [one]=(await f.db.execute(f.sql`select id from rjnx.tournament_registrations where tournament_id=${event.id} and applicant_id=${entrant}`)).rows;
  const other=await f.login('rival');
  const second=(await json(await other.api.post('/api/me/registrations',{data:{tournamentId:event.id,teamId:null,rulesAccepted:true,players:[{id:other.id,ign:'P2'}],note:''}}),201)).id;
  for(const id of [one.id,second])await json(await operator.api.patch(`/api/admin/registrations/${id}`,{data:{status:'approved',reviewNote:'Approved for the UI event.'}}),200);
  await page.goto('/dashboard/my-tournaments');await page.getByText('Approved for the UI event.',{exact:false}).waitFor();
  await admin.goto(`/admin/matches?create=1&tournament=${event.id}`);
  await admin.getByLabel('Match title').fill('UI Arena Final');
  await admin.getByLabel('Round',{exact:true}).fill('Final');
  await admin.getByLabel('Match instructions').fill('Wait for the countdown.');
  await admin.locator('input[name=entry]').nth(0).check();
  await admin.locator('input[name=entry]').nth(1).check();
  await admin.getByLabel('Room ID',{exact:true}).fill('UITEST-ROOM');
  await admin.getByLabel('Room password').fill('OnlyContestants');
  await admin.getByLabel('Release room details to participants').check();
  const scheduled=admin.waitForResponse(r=>r.url().endsWith('/api/admin/matches')&&r.request().method()==='POST');
  await admin.getByRole('button',{name:'Schedule match',exact:true}).click();
  match=(await json(await scheduled,201)).id;
  await admin.waitForURL(p=>p.pathname==='/admin/matches'&&!p.search);
  await page.goto('/dashboard/matches');
  assert.equal(await page.getByText('OnlyContestants',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Reveal room details'}).click();await page.getByText('OnlyContestants',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Hide room details'}).click();assert.equal(await page.getByText('OnlyContestants',{exact:true}).count(),0);
  await admin.goto(`/admin/results?edit=${match}`);
  await admin.getByLabel(/Kills · .*_browser/).fill('6');
  await admin.getByLabel(/Kills · .*_rival/).fill('4');
  await admin.getByRole('button',{name:'Submit results for verification'}).click();
  await admin.getByRole('button',{name:'Verify & publish'}).click();
  await admin.getByRole('button',{name:'Confirm',exact:true}).click();
  await admin.getByText('Published',{exact:true}).waitFor();
  await page.goto('/dashboard/results');await page.getByText('UI Arena Final',{exact:true}).waitFor();await fit(page,360);
  await page.goto('/dashboard/notifications');await page.getByText('Results published',{exact:true}).waitFor();await page.getByRole('button',{name:'Mark all as read'}).click();await page.getByText(/0 unread ·/).waitFor();
  await page.goto('/dashboard/settings');await page.getByRole('button',{name:'Sign out'}).last().click();await page.waitForURL(p=>p.pathname==='/');
  await page.goto('/dashboard');await page.waitForURL(/\/login/);
 });
 assert.deepEqual(problems,[],'no unexpected browser console errors');
});
