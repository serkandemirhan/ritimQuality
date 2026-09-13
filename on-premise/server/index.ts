import { pushRouter } from './routes/push.js';
import { startNotificationWorker } from './services/push.js';
import { workflowRouter } from './routes/workflow.js';
import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { appRouter } from './routes/app.js';

const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api', workflowRouter);
app.use('/api', pushRouter);
startNotificationWorker();
app.use('/api', appRouter);
app.use('/api', (_req,res)=>res.status(404).json({error:'API uç noktası bulunamadı.'}));

const webRoot=resolve('dist');
app.use(express.static(webRoot));
app.get('*', (_req,res)=>res.sendFile(resolve(webRoot,'index.html')));

app.use((error: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Gönderilen veri geçersiz.', details: error.flatten() });
    return;
  }
  const duplicate = (error as unknown as { code?: string }).code === '23505';
  res.status(duplicate ? 409 : (error.status || 500)).json({
    error: duplicate ? 'Bu kayıt daha önce oluşturulmuş.' : (error.message || 'Sunucu hatası.'),
    code: error.code,
  });
});

const port = Number(process.env.API_PORT || 3001);
app.listen(port, () => console.log(`Ritim Quality On-Premise API listening on http://localhost:${port}`));
