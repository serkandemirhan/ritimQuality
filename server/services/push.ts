import webpush from 'web-push';
import type pg from 'pg';
import { pool, withTenant } from '../db/pool.js';

export function validatePushEndpoint(raw:string): boolean {
  try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host));}catch{return false;}
}
export async function remindTasks(client:pg.PoolClient,tenantId:string) {
  await client.query(`INSERT INTO quality_notifications(tenant_id,user_id,title,kind,entity_id)
    SELECT t.tenant_id,t.owner_id,CASE WHEN t.due_at<now() THEN 'Geciken görev: ' ELSE 'Yaklaşan görev: ' END||t.title,
    CASE WHEN t.due_at<now() THEN 'overdue' ELSE 'due_soon' END,t.id::text
    FROM quality_tasks t JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.owner_id
    WHERE t.tenant_id=$1 AND t.completed_at IS NULL AND t.due_at<=now()+interval '1 day' AND u.status='active'
    ON CONFLICT DO NOTHING`,[tenantId]);
}
export async function dispatchTenant(client:pg.PoolClient,tenantId:string, deadline=Date.now()+45000) {
  await remindTasks(client,tenantId);
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT)return;
  const notifications=await client.query(`SELECT n.* FROM quality_notifications n JOIN users u ON u.tenant_id=n.tenant_id AND u.id=n.user_id WHERE n.tenant_id=$1 AND n.push_sent_at IS NULL AND n.push_retry_at<=now() AND n.push_attempts<10 AND u.status='active' ORDER BY n.id LIMIT 10 FOR UPDATE OF n SKIP LOCKED`,[tenantId]);
  for(const notification of notifications.rows){
    if(Date.now()>deadline-11000)break;
    const subscriptions=await client.query('SELECT * FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2',[tenantId,notification.user_id]);
    if(!subscriptions.rowCount){await client.query("UPDATE quality_notifications SET push_retry_at=now()+interval '10 minutes' WHERE tenant_id=$1 AND id=$2",[tenantId,notification.id]);continue;}
    let failed=false;
    for(const sub of subscriptions.rows){
      if(Date.now()>deadline-11000){failed=true;break;}
      try{
        if(!validatePushEndpoint(sub.endpoint))throw new Error('Invalid push endpoint');
        await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},JSON.stringify({title:'Ritim Quality',body:'Yeni bir kalite bildiriminiz var.',tag:'quality-'+notification.id,url:'/?view=work'}),{TTL:3600,timeout:10000,vapidDetails:{subject:process.env.VAPID_SUBJECT,publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY}});
      }catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410)await client.query('DELETE FROM push_subscriptions WHERE tenant_id=$1 AND id=$2',[tenantId,sub.id]);else failed=true;}
    }
    await client.query("UPDATE quality_notifications SET push_attempts=push_attempts+1,push_sent_at=CASE WHEN $3 THEN NULL ELSE now() END,push_retry_at=now()+interval '5 minutes' WHERE tenant_id=$1 AND id=$2",[tenantId,notification.id,failed]);
  }
}
export async function runNotificationBatch() {
  const deadline=Date.now()+45000;
  const tenants=await pool.query('SELECT id FROM tenants ORDER BY notifications_checked_at NULLS FIRST,id LIMIT 10');
  let processed=0;
  for(const tenant of tenants.rows){
    if(Date.now()>deadline-11000)break;
    await withTenant(tenant.id,async client=>{
      const lock=await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired",['notifications:'+tenant.id]);
      if(!lock.rows[0].acquired)return;
      await dispatchTenant(client,tenant.id,deadline);
      await client.query('UPDATE tenants SET notifications_checked_at=now() WHERE id=$1',[tenant.id]);
      processed++;
    });
  }
  return {processed};
}
export function startNotificationWorker(){
  let running=false;
  const tick=async()=>{if(running)return;running=true;try{await runNotificationBatch();}catch(error){console.error('Notification worker failed:',(error as Error).message);}finally{running=false;}};
  const timer=setInterval(()=>void tick(),60000);timer.unref();return timer;
}
