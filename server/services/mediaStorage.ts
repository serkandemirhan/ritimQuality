import { createClient } from '@supabase/supabase-js';

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'] as const;
export function usesSupabaseStorage() {
  if (process.env.MEDIA_STORAGE === 'supabase') return true;
  if (process.env.VERCEL) throw new Error('Vercel requires MEDIA_STORAGE=supabase');
  return false;
}
let storageClient: ReturnType<typeof createClient> | undefined;
export function supabaseStorage() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Supabase Storage configuration is missing');
  storageClient ??= createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return storageClient.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'quality-evidence');
}
export function mediaObjectPath(tenantId: string, id: string) { return `${tenantId}/${id}`; }
export function assertUploadedObject(info: { size?: number; contentType?: string }, expected: { size_bytes: number; mime_type: string }) {
  if (info.size !== expected.size_bytes || !info.size || info.size > MAX_MEDIA_BYTES || info.contentType !== expected.mime_type)
    throw Object.assign(new Error('Yüklenen dosyanın türü veya boyutu beklenen değerle eşleşmiyor.'), { status: 409 });
}
