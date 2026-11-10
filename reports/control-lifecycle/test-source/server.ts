import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {pool} from '../server/db/pool.js';
import {signToken} from '../server/middleware/auth.js';
import app from '../server/app.js';
import {createServer} from 'vite';
const tenantId=randomUUID();
const users=[{id:randomUUID(),name:'Deniz Yönetici',role:'admin' as const},{id:randomUUID(),name:'Ece Operatör',role:'operator' as const}];
if(!existsSync('.runtime/lifecycle/session.json')){
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query("INSERT INTO tenants(id,slug,name,legal_name,contact_email,plan_id,subscription_status,billing_source) VALUES($1,$2,'Akış Testi — Deneme','Akış Testi — Deneme','no-mail@example.invalid','pro','trial','manual')",[tenantId,'flow-'+tenantId.slice(0,8)+'-demo']);
 await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
 for(const user of users)await client.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role,station_or_machine,email_verified_at) VALUES($1,$2,$3,$4,'unusable',$5,'CNC-01',now())",[user.id,tenantId,user.name,user.role+'@example.invalid',user.role]);
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
mkdirSync('.runtime/lifecycle',{recursive:true});
writeFileSync('.runtime/lifecycle/session.json',JSON.stringify({tenantId,users:users.map(u=>({...u,token:signToken({tenantId,userId:u.id,role:u.role})}))}));
}
const vite=await createServer({server:{middlewareMode:true,proxy:{},hmr:false,watch:null},appType:'spa'});
app.use(vite.middlewares);
app.listen(3420,'127.0.0.1',()=>console.log('Lifecycle real API + Supabase isolated tenant ready at 3420. No mail or push worker started.'));
