import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withDatabase } from '../db/pool.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, tenantId } = await withDatabase(async (client, tenantId) => {
      const result = await client.query(
        `SELECT id, name, email, password_hash, role, department, station_or_machine, status
         FROM users WHERE tenant_id=$1 AND email=$2`,
        [tenantId, input.email.toLowerCase()],
      );
      return { user: result.rows[0], tenantId };
    });
    if (!user || user.status !== 'active' || !(await bcrypt.compare(input.password, user.password_hash))) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
      return;
    }
    await withDatabase(client => client.query('UPDATE users SET last_login_at=now() WHERE id=$1 AND tenant_id=$2', [user.id, tenantId]).then(() => undefined));
    res.json({ token: signToken({ userId: user.id, tenantId, role: user.role }), user: { ...user, password_hash: undefined } });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await withDatabase((client, tenantId) => client.query(
      `SELECT id, name, email, role, department, station_or_machine, status, last_login_at
       FROM users WHERE id=$1 AND tenant_id=$2`,
      [req.auth!.userId, tenantId],
    ));
    if (!result.rows[0]) { res.status(404).json({ error: 'Kullanıcı bulunamadı.' }); return; }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});
