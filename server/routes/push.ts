import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { withTenant } from '../db/pool.js';
import { validatePushEndpoint } from '../services/push.js';
export const pushRouter=Router();pushRouter.use(requireAuth);
pushRouter.get('/push/config',(_req,res)=>res.json({publicKey:process.env.VAPID_PUBLIC_KEY||null,enabled:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)}));
pushRouter.post('/push/subscriptions',async(req,res,next)=>{try{
  const input=z.object({endpoint:z.string().url().max(3000).refine(validatePushEndpoint),keys:z.object({p256dh:z.string().min(40).max(200),auth:z.string().min(16).max(100)})}).parse(req.body);
  const {tenantId,userId}=req.auth!;
  await withTenant(tenantId,client=>client.query('INSERT INTO push_subscriptions(tenant_id,user_id,endpoint,keys) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,user_id,endpoint) DO UPDATE SET keys=$4',[tenantId,userId,input.endpoint,input.keys]));res.status(204).end();
}catch(error){next(error);}});
pushRouter.delete('/push/subscriptions',async(req,res,next)=>{try{const {tenantId,userId}=req.auth!;await withTenant(tenantId,client=>client.query('DELETE FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2',[tenantId,userId]));res.status(204).end();}catch(error){next(error);}});
