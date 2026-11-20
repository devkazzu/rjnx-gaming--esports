import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

// Run only with a trusted operator's DB credentials. There is no HTTP bootstrap endpoint.
const requested=process.argv[2]?.trim().toLowerCase();
if(!requested||!(/^[a-z0-9_]{3,24}$/.test(requested)))throw Error('Usage: node scripts/bootstrap-admin.mjs <existing verified player handle>');
const conn=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!conn)throw Error('Set a trusted operator database connection.');
const pool=new Pool({connectionString:conn,connectionTimeoutMillis:5000});
try{
  const db=drizzle(pool);
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('staff:role-changes',0))`);
    const existing=await tx.execute(sql`select 1 from rjnx.user_roles where role='super_admin' limit 1`);
    if(existing.rows.length)throw Error('A Super Admin already exists. Use authorized staff role management.');
    const [user]=(await tx.execute(sql`select id from rjnx.profiles where username=${requested} and not suspended for update`)).rows;
    if(!user)throw Error('Active player not found. Sign in with the verified operator account to provision its profile first.');
    const hosted=await tx.execute(sql`select to_regclass('auth.users') is not null as present`);
    if(hosted.rows[0].present){
      const [record]=(await tx.execute(sql`select id from auth.users where id=${user.id} and email_confirmed_at is not null`)).rows;
      if(!record)throw Error('This profile has no verified Supabase account.');
    }else{
      const local=new URL(conn);
      if(!['localhost','127.0.0.1','[::1]'].includes(local.hostname))throw Error('Non-Supabase bootstrap must run only on loopback.');
      const [account]=(await tx.execute(sql`select user_id from rjnx.local_accounts where user_id=${user.id}`)).rows;
      if(!account)throw Error('This handle has no registered local account.');
    }
    await tx.execute(sql`insert into rjnx.user_roles(user_id,role) values (${user.id},'super_admin') on conflict(user_id) do update set role='super_admin',updated_at=now()`);
    await tx.execute(sql`insert into rjnx.audit_logs(actor_id,action,target,details) values (null,'staff.bootstrap',${String(user.id)},'{"role":"super_admin"}'::jsonb)`);
  });
  console.log('First Super Admin initialized for the verified operator account.');
}finally{await pool.end();}
