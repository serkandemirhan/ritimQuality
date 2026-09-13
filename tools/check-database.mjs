import 'dotenv/config';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000});
try {
  console.log(JSON.stringify((await pool.query("SELECT rolcreatedb,rolsuper,has_database_privilege(current_database(),'CREATE') can_create_schema FROM pg_roles WHERE rolname=current_user")).rows));
  console.log(JSON.stringify((await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows));
}finally{await pool.end();}
