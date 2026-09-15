import 'dotenv/config';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000});
try {
  console.log(JSON.stringify((await pool.query("SELECT rolcreatedb,rolsuper,has_database_privilege(current_database(),'CREATE') can_create_schema FROM pg_roles WHERE rolname=current_user")).rows));
  try{console.log(JSON.stringify((await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows));}catch(error){console.log(JSON.stringify({schemaMigrationsReadable:false,code:error.code}));}
  console.log(JSON.stringify((await pool.query("SELECT to_regclass('public.stations') stations,to_regclass('public.quality_tasks') quality_tasks,to_regclass('public.inspection_drafts') inspection_drafts")).rows));
}finally{await pool.end();}
