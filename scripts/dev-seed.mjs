import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

const url=new URL(process.env.DATABASE_URL||'');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||process.env.VERCEL||process.env.RJNX_AUTH_MODE==='supabase')throw Error('Development seed is restricted to local PostgreSQL.');
const pool=new Pool({connectionString:url.toString(),connectionTimeoutMillis:5000});
try{const db=drizzle(pool);const source=await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8');await db.transaction(tx=>tx.execute(sql.raw(source)));console.log('RJNX development records are ready. No credentials were seeded.');}finally{await pool.end();}
