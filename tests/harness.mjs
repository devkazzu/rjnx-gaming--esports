import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { request } from 'playwright';
import sharp from 'sharp';

export const baseURL=process.env.BASE_URL||'http://127.0.0.1:3000';
export const connection=process.env.RJNX_TEST_DATABASE_URL;
export const png=await sharp({create:{width:12,height:12,channels:4,background:'#8054f0'}}).png().toBuffer();
export async function json(response,status){const body=await response.text(); assert.equal(response.status(),status,`${response.url()}: ${body.slice(0,600)}`);return JSON.parse(body);}
export async function fx(){
  if(!connection||!['127.0.0.1','localhost','[::1]'].includes(new URL(connection).hostname))throw Error('Tests must target disposable loopback PostgreSQL.');
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(baseURL).hostname))throw Error('Tests must target a local RJNX server.');
  const pool=new Pool({connectionString:connection,max:2});const db=drizzle(pool);
  const tag=randomBytes(5).toString('hex');const prefix=`qa_${tag}`;
  const d={users:[],teams:[],events:[],articles:[],announcements:[],reports:[],media:[]};
  const contexts=[];
  const names=handle=>({username:`${prefix}_${handle}`,email:`${prefix}_${handle}@example.test`,password:`RJNX test ${randomBytes(15).toString('hex')}`});
  async function client(){const value=await request.newContext({baseURL});contexts.push(value);return value;}
  async function idByName(username){const [row]=(await db.execute(sql`select id from rjnx.profiles where username=${username}`)).rows; if(row?.id&&!d.users.includes(row.id))d.users.push(row.id);return row?.id;}
  async function role(uid,role){const rows=await db.execute(sql`update rjnx.user_roles set role=${role}::rjnx.staff_role where user_id=${uid} returning user_id`);assert.equal(rows.rowCount,1);}
  async function login(handle,who='player'){
    const account=names(handle), api=await client();
    await json(await api.post('/api/session',{data:{action:'register',...account}}),200);
    const uid=await idByName(account.username); assert.ok(uid);
    if(who!=='player')await role(uid,who);
    return {...account,api,id:uid};
  }
  async function game(slug='valorant'){const [row]=(await db.execute(sql`select id from rjnx.games where slug=${slug}`)).rows;assert.ok(row?.id);return row.id;}
  const times=()=>Object.fromEntries([['regStart',-2],['regEnd',2],['startsAt',3],['endsAt',6]].map(([k,h])=>[k,new Date(Date.now()+h*3600_000).toISOString()]));
  async function event(api,name,extra={}){
    const payload={title:`${prefix} ${name}`,slug:`qa-${tag}-${name.replaceAll(' ','-').toLowerCase()}`,gameId:await game(),description:'A real test competition with private staff controls.',rules:'Play fair, keep room credentials private, and use your submitted handle.',format:'Points Based',mode:'solo',squadSize:1,status:'open',season:'QA Season',prize:'Community cup',platform:'PC',capacity:2,featured:false,bannerId:null,logoId:null,scoring:{placements:{1:15,2:8},killPoints:2,winPoints:3,bonusMax:7,penaltyMax:8},...times(),...extra};
    const {id}=await json(await api.post('/api/admin/tournaments',{data:payload}),201);d.events.push(id);return {...payload,id};
  }
  const deleteIds=(ids)=>sql.join(ids.map(v=>sql`${v}::uuid`),sql`, `);
  async function cleanup(){
    try{
      await db.transaction(async tx=>{
        const users=d.users.length?sql` in (${deleteIds(d.users)})`:null;
        const events=d.events.length?sql` in (${deleteIds(d.events)})`:null;
        if(users)await tx.execute(sql`delete from rjnx.notifications where user_id ${users} or title ilike ${`%${prefix}%`}`);
        if(d.announcements.length)await tx.execute(sql`delete from rjnx.announcements where id in (${deleteIds(d.announcements)})`);
        if(d.reports.length)await tx.execute(sql`delete from rjnx.reports where id in (${deleteIds(d.reports)})`);
        if(d.articles.length)await tx.execute(sql`delete from rjnx.news_articles where id in (${deleteIds(d.articles)})`);
        if(events){await tx.execute(sql`delete from rjnx.result_history where match_id in(select id from rjnx.matches where tournament_id ${events})`);await tx.execute(sql`delete from rjnx.matches where tournament_id ${events}`);await tx.execute(sql`delete from rjnx.tournament_registrations where tournament_id ${events}`);await tx.execute(sql`delete from rjnx.tournaments where id ${events}`);}
        if(d.teams.length)await tx.execute(sql`delete from rjnx.teams where id in (${deleteIds(d.teams)})`);
        if(users){await tx.execute(sql`delete from rjnx.audit_logs where actor_id ${users}`);await tx.execute(sql`delete from rjnx.media where uploader ${users}`);await tx.execute(sql`delete from rjnx.profiles where id ${users}`);}
      });
    } finally {for(const c of contexts)await c.dispose();await pool.end();}
  }
  return {db,sql,tag,prefix,login,client,names,idByName,role,game,event,cleanup,d};
}
