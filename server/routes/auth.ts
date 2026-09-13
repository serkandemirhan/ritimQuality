import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTenant } from '../db/pool.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  workspace: z.string().min(3).max(49).regex(/^[a-z0-9][a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});

authRouter.post('/register', async (req, res, next) => {
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

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [input.workspace]);
    const tenantId = tenantResult.rows[0]?.id;
    if (!tenantId) { res.status(401).json({ error: 'Çalışma alanı veya giriş bilgileri hatalı.' }); return; }
    const user = await withTenant(tenantId, async client => {
      const result = await client.query(
        `SELECT id, tenant_id, name, email, password_hash, role, department, status
         FROM users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, input.email.toLowerCase()],
      );
      return result.rows[0];
    });
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      res.status(401).json({ error: 'Çalışma alanı veya giriş bilgileri hatalı.' }); return;
    }
    await withTenant(tenantId, client => client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]).then(() => undefined));
    res.json({ token: signToken({ userId: user.id, tenantId, role: user.role }), user: { ...user, password_hash: undefined } });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, client => client.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.station_or_machine, u.status,
              t.id tenant_id, t.slug workspace, t.name company_name, t.plan_id, t.subscription_status
       FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    ));
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

