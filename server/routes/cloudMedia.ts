import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withTenant } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { assertSubscription } from '../services/access.js';
import { assertUploadedObject, MAX_MEDIA_BYTES, MEDIA_MIME_TYPES, mediaObjectPath, supabaseStorage, usesSupabaseStorage } from '../services/mediaStorage.js';

export const cloudMediaRouter = Router();
cloudMediaRouter.use(requireAuth);
cloudMediaRouter.get('/media/config', (_req, res) => res.json({ provider: usesSupabaseStorage() ? 'supabase' : 'local', maxBytes: MAX_MEDIA_BYTES }));
cloudMediaRouter.post('/media/uploads', requireRole('admin', 'quality_engineer', 'operator'), async (req, res, next) => {
  try {
    if (!usesSupabaseStorage()) { res.status(409).json({ error: 'Doğrudan yükleme bu ortamda etkin değil.' }); return; }
    const input = z.object({ fileName: z.string().trim().min(1).max(180), mimeType: z.enum(MEDIA_MIME_TYPES), size: z.number().int().positive().max(MAX_MEDIA_BYTES) }).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const id = randomUUID(); const path = mediaObjectPath(tenantId, id);
    const kind = input.mimeType.startsWith('image/') ? 'photo' : input.mimeType.startsWith('video/') ? 'video' : 'file';
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      await client.query('SELECT id FROM users WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, userId]);
      const pending = await client.query("SELECT count(*)::int count FROM media_evidence WHERE tenant_id=$1 AND uploaded_by=$2 AND upload_status='pending' AND upload_expires_at>now()", [tenantId, userId]);
      if (pending.rows[0].count >= 30) throw Object.assign(new Error('Çok fazla tamamlanmamış yükleme var. Mevcut yüklemeleri tamamlayın.'), { status: 429 });
      await client.query(`INSERT INTO media_evidence(id,tenant_id,file_name,mime_type,kind,storage_path,size_bytes,uploaded_by,storage_provider,upload_status,upload_expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'supabase','pending',now()+interval '2 hours')`, [id, tenantId, input.fileName, input.mimeType, kind, path, input.size, userId]);
    });
    const signed = await supabaseStorage().createSignedUploadUrl(path, { upsert: false });
    if (signed.error) throw signed.error;
    res.status(201).json({ id, uploadUrl: signed.data.signedUrl });
  } catch (error) { next(error); }
});
cloudMediaRouter.post('/media/uploads/:id/complete', requireRole('admin', 'quality_engineer', 'operator'), async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id); const { tenantId, userId } = req.auth!;
    const media = await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const row = (await client.query("SELECT * FROM media_evidence WHERE tenant_id=$1 AND id=$2 AND uploaded_by=$3 AND storage_provider='supabase' FOR UPDATE", [tenantId, id, userId])).rows[0];
      if (!row) throw Object.assign(new Error('Yükleme bulunamadı.'), { status: 404 });
      if (row.upload_status !== 'ready') {
        if (new Date(row.upload_expires_at).getTime() < Date.now()) throw Object.assign(new Error('Yükleme süresi doldu. Dosyayı yeniden yükleyin.'), { status: 409 });
        const info = await supabaseStorage().info(row.storage_path);
        if (info.error) throw Object.assign(new Error('Dosya henüz depolamaya ulaşmadı. Yüklemeyi tamamlayın.'), { status: 409 });
        assertUploadedObject(info.data, row);
        await client.query("UPDATE media_evidence SET upload_status='ready' WHERE tenant_id=$1 AND id=$2", [tenantId, id]);
      }
      return row;
    });
    res.json({ id: media.id, fileName: media.file_name, mimeType: media.mime_type, kind: media.kind, url: `/api/media/${media.id}`, createdAt: media.created_at });
  } catch (error) { next(error); }
});
