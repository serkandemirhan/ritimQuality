import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { runNotificationBatch } from '../services/push.js';

export function validCronToken(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const cronRouter = Router();
cronRouter.get('/notifications', async (req, res, next) => {
  if (!validCronToken(req.headers.authorization, process.env.CRON_SECRET)) { res.status(401).json({ error: 'Geçersiz görev yetkisi.' }); return; }
  try { res.json(await runNotificationBatch()); } catch (error) { next(error); }
});
