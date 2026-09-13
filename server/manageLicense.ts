import 'dotenv/config';
import { pool,withTenant } from './db/pool.js';
import { z } from 'zod';
// Run with a trusted server administrator's database credentials, never a customer browser.
const args=process.argv.slice(2);
const value=(key:string)=>args[args.indexOf(key)+1];
try{
  const tenantId=z.string().uuid().parse(value('--tenant'));
  const plan=z.enum(['starter','pro','enterprise']).parse(value('--plan'));
  const expires=z.string().datetime().parse(value('--expires'));
  if(new Date(expires).getTime()<=Date.now())throw new Error('License expiry must be in the future');
  const company=(await pool.query('SELECT id,name,stripe_subscription_id FROM tenants WHERE id=$1',[tenantId])).rows[0];
  if(!company)throw new Error('Tenant not found');
  if(company.stripe_subscription_id)throw new Error('Resolve the existing Stripe subscription before switching to manual billing');
  console.log(JSON.stringify({tenantId,company:company.name,plan,expires,apply:args.includes('--apply')}));
  if(args.includes('--apply'))await withTenant(tenantId,async client=>{
    const before=(await client.query('SELECT plan_id,subscription_status,billing_source,manual_license_ends_at FROM tenants WHERE id=$1 FOR UPDATE',[tenantId])).rows[0];
    await client.query("UPDATE tenants SET plan_id=$2,subscription_status='active',billing_source='manual',manual_license_ends_at=$3,updated_at=now() WHERE id=$1",[tenantId,plan,expires]);
    await client.query("INSERT INTO audit_logs(tenant_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,'license.manual','tenant',$1,$2,$3)",[tenantId,before,{plan,expires}]);
  });
}finally{await pool.end();}
