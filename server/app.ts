import express from 'express';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { billingRouter, stripeWebhookHandler } from './routes/billing.js';
import { saasRouter } from './routes/saas.js';
import { workflowRouter } from './routes/workflow.js';
import { mediaRouter } from './routes/media.js';
import { pushRouter } from './routes/push.js';
import { cronRouter } from './routes/cron.js';
import { cloudMediaRouter } from './routes/cloudMedia.js';
import { draftRouter } from './routes/drafts.js';

// Importable in Vercel and tests: no listening socket or background timer here.
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhookHandler);
app.use(express.json({ limit: process.env.VERCEL ? '3mb' : '10mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/cron', cronRouter);
app.use('/api/auth', authRouter);
app.use('/api', workflowRouter);
app.use('/api', pushRouter);
app.use('/api/billing', billingRouter);
app.use('/api', cloudMediaRouter);
app.use('/api', draftRouter);
app.use('/api', mediaRouter);
app.use('/api', saasRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API adresi bulunamadı.' }));
app.use((error: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) { res.status(400).json({ error: 'Gönderilen veri geçersiz.', details: error.flatten() }); return; }
  const conflict = ['23505', '23503', '23514'].includes(error.code || '');
  const status = conflict ? 409 : error.status || 500;
  if (status >= 500) console.error('API failure', { name: error.name, code: error.code });
  res.status(status).json({
    error: status >= 500 ? 'Sunucu işlemi tamamlayamadı. Lütfen tekrar deneyin.' : conflict ? 'Kayıt ilişkisi veya veri bütünlüğü kuralı bu işleme izin vermiyor.' : error.message,
    ...(status < 500 && error.code ? { code: error.code } : {}),
  });
});
export default app;
