import { Router } from 'express';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { withTenant } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseStorage, usesSupabaseStorage } from '../services/mediaStorage.js';
export const mediaRouter=Router();
mediaRouter.use(requireAuth);
const mediaRoot = resolve(process.env.MEDIA_ROOT || '.data/media');

mediaRouter.post('/media', requireRole('admin','quality_engineer','operator'), async (req,res,next) => {
  try {
    if (usesSupabaseStorage()) { res.status(409).json({error:'Dosyaları doğrudan yükleme akışıyla gönderin.'}); return; }
    const input=z.object({fileName:z.string().min(1).max(180),mimeType:z.string().min(1).max(120),kind:z.enum(['photo','video','file']),dataUrl:z.string().min(10)}).parse(req.body);
    const match=input.dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if(!match||match[1]!==input.mimeType){res.status(400).json({error:'Geçersiz medya içeriği.'});return;}
    const data=Buffer.from(match[2],'base64');
    if(!data.length||data.length>8*1024*1024){res.status(413).json({error:'Dosya boyutu 8 MB sınırını aşıyor.'});return;}
    const extension=input.mimeType==='image/jpeg'?'.jpg':input.mimeType==='image/png'?'.png':input.mimeType==='image/webp'?'.webp':input.mimeType==='video/mp4'?'.mp4':input.mimeType==='application/pdf'?'.pdf':'.bin';
    const id=randomUUID(); const storageName=`${id}${extension}`;
    await mkdir(mediaRoot,{recursive:true});
    await writeFile(resolve(mediaRoot,storageName),data,{flag:'wx'});
    const createdAt=new Date().toISOString();
    await withTenant(req.auth!.tenantId, client=>client.query(`INSERT INTO media_evidence(id,tenant_id,file_name,mime_type,kind,storage_path,size_bytes,uploaded_by) VALUES($1,current_setting('app.tenant_id')::uuid,$2,$3,$4,$5,$6,$7)`,[id,input.fileName,input.mimeType,input.kind,storageName,data.length,req.auth!.userId]).then(()=>undefined));
    res.status(201).json({id,fileName:input.fileName,mimeType:input.mimeType,kind:input.kind,url:`/api/media/${id}`,createdAt});
  } catch(error){next(error);}
});

mediaRouter.get('/media/:id', async (req,res,next) => {
  try {
    const id=z.string().uuid().parse(req.params.id);
    const result=await withTenant(req.auth!.tenantId, client=>client.query("SELECT file_name,mime_type,storage_path,storage_provider FROM media_evidence WHERE id=$1 AND tenant_id=$2 AND upload_status='ready'",[id,req.auth!.tenantId]));
    const media=result.rows[0]; if(!media){res.status(404).json({error:'Medya bulunamadı.'});return;}
    if (media.storage_provider === 'supabase') {
      const signed = await supabaseStorage().createSignedUrl(media.storage_path, 300);
      if (signed.error) throw signed.error;
      res.json({ downloadUrl: signed.data.signedUrl }); return;
    }
    if (process.env.VERCEL) { res.status(409).json({error:'Bu eski dosya henüz Supabase Storage’a taşınmamış.'}); return; }
    res.type(media.mime_type); res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(media.file_name)}`); res.sendFile(resolve(mediaRoot,media.storage_path));
  } catch(error){next(error);}
});
