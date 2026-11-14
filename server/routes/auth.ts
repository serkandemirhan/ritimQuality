import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTenant } from '../db/pool.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import {requestLimit,consumeLimit} from '../services/requestLimit.js';
import {accountMailConfigured,sendAccountMail} from '../services/accountMail.js';
import {issueAccountToken,redeemAccountToken} from '../services/accountTokens.js';

export const authRouter = Router();

authRouter.get('/capabilities',(_req,res)=>res.json({accountEmail:accountMailConfigured()}));
authRouter.post('/account-link',requestLimit('account-link',10,3600),async(req,res,next)=>{
  try {
    const input=z.object({workspace:z.string().min(3).max(49),email:z.string().email().max(254),purpose:z.enum(['reset','verify'])}).parse(req.body);
    if(!accountMailConfigured()){res.status(503).json({error:'E-posta ile hesap işlemleri henüz etkin değil. Firma yöneticinizle iletişime geçin.'});return;}
    if(!await consumeLimit('account-link-recipient',`${input.workspace}:${input.email.toLowerCase()}`,3,3600)) {
      res.status(429).json({error:'Yeni bağlantı istemeden önce lütfen bir saat bekleyin.'});return;
    }
    const tenant=(await pool.query('SELECT id FROM tenants WHERE slug=$1',[input.workspace])).rows[0];
    if(tenant){
      const user=await withTenant(tenant.id,async client=>(await client.query("SELECT id,email,email_verified_at FROM users WHERE tenant_id=$1 AND email=$2 AND status='active'",[tenant.id,input.email.toLowerCase()])).rows[0]);
      if(user && (input.purpose==='reset'||!user.email_verified_at)) {
        const token=await issueAccountToken(tenant.id,user.id,input.purpose);
        try {await sendAccountMail(user.email,token,input.purpose);} catch {console.error('Account email delivery failed');}
      }
    }
    res.status(202).json({message:'Talebiniz alındı. Bilgilerinizle eşleşen uygun bir hesap varsa e-posta bağlantısını kullanabilirsiniz. Gelen kutunuzu ve gereksiz klasörünü kontrol edin.'});
  } catch(error){next(error);}
});
authRouter.post('/redeem-link',requestLimit('redeem-link',20),async(req,res,next)=>{
  try {
    const input=z.object({token:z.string().max(100),purpose:z.enum(['reset','verify']),password:z.string().min(10).max(72).optional()}).parse(req.body);
    if(input.purpose==='reset'&&(!input.password||Buffer.byteLength(input.password,'utf8')>72)) {res.status(400).json({error:'Şifre en az 10 karakter olmalı ve 72 baytı aşmamalıdır.'});return;}
    if(!await redeemAccountToken(input.token,input.purpose,input.password)){res.status(400).json({error:'Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir bağlantı isteyin.'});return;}
    res.json({message:input.purpose==='reset'?'Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.':'E-posta adresiniz doğrulandı.'});
  }catch(error){next(error);}
});

const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  workspace: z.string().min(3).max(49).regex(/^[a-z0-9][a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(72).refine(value=>Buffer.byteLength(value,'utf8')<=72,'Şifre 72 baytı aşamaz.'),
});

authRouter.post('/register', requestLimit('register',10,3600), async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenantResult = await client.query(
        `INSERT INTO tenants (slug, name, legal_name, contact_email)
         VALUES ($1, $2, $2, $3) RETURNING id, slug, name, plan_id, subscription_status, trial_ends_at`,
        [input.workspace, input.companyName, input.email.toLowerCase()],
      );
      const tenant = tenantResult.rows[0];
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
      const passwordHash = await bcrypt.hash(input.password, 12);
      const userResult = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, department)
         VALUES ($1, $2, $3, $4, 'admin', 'Yönetim')
         RETURNING id, name, email, role, department, status`,
        [tenant.id, input.name, input.email.toLowerCase(), passwordHash],
      );
      await client.query('COMMIT');
      const user = userResult.rows[0];
      res.status(201).json({ token: signToken({ userId: user.id, tenantId: tenant.id, role: user.role }), tenant, user });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) { next(error); }
});

const loginSchema = z.object({ workspace: z.string().min(3), email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', requestLimit('login',60), async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    if(!await consumeLimit('login-account',`${input.workspace}:${input.email.toLowerCase()}`,20,900)) {
      res.status(429).json({error:'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.'});return;
    }
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [input.workspace]);
    const tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) { res.status(401).json({ error: 'Çalışma alanı veya giriş bilgileri hatalı.' }); return; }
    const user = await withTenant(tenantId, async client => {
      const result = await client.query(
        `SELECT id, tenant_id, name, email, password_hash, role, department, status, session_version
         FROM users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, input.email.toLowerCase()],
      );
      return result.rows[0];
    });
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      res.status(401).json({ error: 'Çalışma alanı veya giriş bilgileri hatalı.' }); return;
    }
    await withTenant(tenantId, client => client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]).then(() => undefined));
    res.json({ token: signToken({ userId: user.id, tenantId, role: user.role, sessionVersion:user.session_version }), user: { ...user, password_hash: undefined } });
  } catch (error) { next(error); }
});

authRouter.post('/platform-login', requestLimit('platform-login', 60), async (req, res, next) => {
  try {
    const input = z.object({email:z.string().email().max(254), password:z.string().min(1).max(72)}).parse(req.body);
    const email = input.email.toLowerCase();
    if (!await consumeLimit('platform-login-account', email, 20, 900)) {
      res.status(429).json({error:'?ok fazla giri? denemesi. L?tfen 15 dakika sonra tekrar deneyin.'}); return;
    }
    const ids = [...new Set((process.env.PLATFORM_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean))];
    const matches: Array<{id:string;tenant_id:string;password_hash:string;role:import('../middleware/auth.js').Role;status:string;session_version:number}> = [];
    if (ids.length) {
      const tenants = await pool.query('SELECT id FROM tenants WHERE NOT platform_suspended');
      for (const tenant of tenants.rows) {
        const rows = await withTenant(tenant.id, client => client.query(
          'SELECT id,tenant_id,password_hash,role,status,session_version FROM users WHERE tenant_id=$1 AND id = ANY($2::text[]) AND lower(email)=$3',
          [tenant.id, ids, email]));
        matches.push(...rows.rows);
      }
    }
    const user = matches.length === 1 ? matches[0] : undefined;
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      res.status(401).json({error:'E-posta veya ?ifre hatal? ya da platform eri?iminiz yok.'}); return;
    }
    await withTenant(user.tenant_id, client => client.query('UPDATE users SET last_login_at=now() WHERE tenant_id=$1 AND id=$2',[user.tenant_id,user.id]).then(() => undefined));
    res.json({token:signToken({userId:user.id,tenantId:user.tenant_id,role:user.role,sessionVersion:user.session_version})});
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, client => client.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.station_or_machine, u.status,
              u.email_verified_at, t.id tenant_id, t.slug workspace, t.name company_name, t.plan_id, t.subscription_status
       FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    ));
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});
