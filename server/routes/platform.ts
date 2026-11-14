import { discardPlatformPackage } from '../services/platformCleanup.js';
import { Router, raw, type RequestHandler } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin, isPlatformAdmin } from '../middleware/platform.js';
import { withPlatform, platformAudit } from '../services/platformContext.js';
import { PACKAGE_TABLES, packageTable, publicRow, existingRow, conflictingRow, validatePackageRows, insertPackageRow, validatePackageReferences, digest, canonical, type DataRow, type PlatformManifest } from '../services/platformPackage.js';
import { supabaseStorage, usesSupabaseStorage, MAX_MEDIA_BYTES, MEDIA_MIME_TYPES } from '../services/mediaStorage.js';
import { hasUnlimitedPilot } from '../services/pilotAccess.js';
import type pg from 'pg';
export const platformRouter = Router();
platformRouter.use(requireAuth, requirePlatformAdmin);
const wrap=(fn:RequestHandler):RequestHandler=>(req,res,next)=>{
 Promise.resolve().then(()=>fn(req,res,next)).catch(async error=>{
  try{await withPlatform(null,async c=>{
   const match=req.path.match(/\/tenants\/([a-f0-9-]{36})(?:\/|$)/i),target=match?(await c.query('SELECT id FROM tenants WHERE id=$1',[match[1]])).rows[0]?.id:null;
   await platformAudit(c,req.auth!.userId,target||null,'platform.operation.failed','Platform işlemi başarısız',{method:req.method,path:req.path,status: error.status || (["23505", "23503", "23514"].includes(error.code) ? 409 : error instanceof z.ZodError ? 400 : 500),code:error.code||null});
  });}catch{console.error('Platform failure audit unavailable');}
  next(error);
 });
};
const uuid = z.string().uuid(), reason = z.string().trim().min(5).max(500);
const fail = (message: string, status = 409) => Object.assign(Error(message), { status });
const mediaRoot = resolve(process.env.MEDIA_ROOT || '.data/media');
function localFile(name: string) { const path = resolve(mediaRoot, name); if (!path.startsWith(mediaRoot + sep))
    throw fail('Dosya yolu geçersiz.', 400); return path; }
async function schema(client: pg.PoolClient) { const r = await client.query("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1) ORDER BY table_name,ordinal_position", [[...PACKAGE_TABLES]]); return [digest(Buffer.from(canonical(r.rows)))]; }
async function tenant(client: pg.PoolClient, id: string) { const row = (await client.query('SELECT id,slug,name,legal_name,tax_number,tax_office,industry,facility_location,contact_email,contact_phone,inspection_rules,next_control_number,pilot_unlimited,platform_suspended,plan_id,subscription_status,trial_ends_at,billing_source,manual_license_ends_at,(stripe_subscription_id IS NOT NULL) AS stripe_linked,created_at FROM tenants WHERE id=$1', [id])).rows[0]; if (!row)
    throw fail('Firma bulunamadı.', 404); return row; }
async function job(client: pg.PoolClient, id: string, actor: string, tenantId: string, kind?: string) { const row = (await client.query('SELECT * FROM platform_packages WHERE id=$1 AND actor_user_id=$2 AND tenant_id=$3 AND expires_at>now() FOR UPDATE', [id, actor, tenantId])).rows[0]; if (!row || kind && row.kind !== kind)
    throw fail('Paket bulunamadı veya süresi doldu.', 404); return row; }
async function snapshotRows(client: pg.PoolClient, id: string, table: string) { return (await client.query('SELECT row_data FROM platform_package_rows WHERE package_id=$1 AND table_name=$2 ORDER BY ordinal', [id, table])).rows.map(r => r.row_data as DataRow); }
const fileSchema = z.object({ id: uuid, size: z.number().int().positive().max(MAX_MEDIA_BYTES), mime: z.enum(MEDIA_MIME_TYPES), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const manifestSchema = z.object({ format: z.literal('ritim-tenant'), version: z.literal(1), tenant: z.object({ id: uuid, slug: z.string(), name: z.string() }).passthrough(), schema: z.array(z.string()), counts: z.record(z.number().int().min(0)), files: z.array(fileSchema), createdAt: z.string() });
platformRouter.get('/me', wrap((req, res) => { res.json({ userId: req.auth!.userId, tenantId: req.auth!.tenantId }); }));
platformRouter.get('/tenants', wrap(async (req, res) => {
    const q = z.string().max(100).parse(req.query.q || ''), after = z.string().parse(req.query.after || '');
    const data = await withPlatform(null, async (c) => { await c.query("DELETE FROM platform_packages WHERE expires_at<now() AND kind='backup'"); return (await c.query("SELECT id,slug,name,contact_email,plan_id,subscription_status,trial_ends_at,pilot_unlimited,platform_suspended,created_at FROM tenants WHERE (name ILIKE $1 OR slug ILIKE $1) AND slug>$2 ORDER BY slug LIMIT 101", ['%' + q + '%', after])).rows; });
    res.json({ tenants: data.slice(0, 100).map(t => ({ ...t, unlimitedPilot: hasUnlimitedPilot(t) })), next: data.length > 100 ? data[99].slug : null });
}));
platformRouter.post('/tenants', wrap(async (req, res) => {
    const b = z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,48}$/), name: z.string().trim().min(2).max(120), adminName: z.string().min(2).max(100), email: z.string().email(), password: z.string().min(12).max(72).refine(v => Buffer.byteLength(v) <= 72), unlimitedPilot: z.boolean(), reason }).parse(req.body);
    const hash = await bcrypt.hash(b.password, 12);
    const result = await withPlatform(null, async (c) => { const t = (await c.query('INSERT INTO tenants(slug,name,legal_name,contact_email,pilot_unlimited) VALUES($1,$2,$2,$3,$4) RETURNING id,slug,name', [b.slug, b.name, b.email.toLowerCase(), b.unlimitedPilot])).rows[0]; await c.query("SELECT set_config('app.tenant_id',$1,true)", [t.id]); const u = (await c.query("INSERT INTO users(tenant_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'admin') RETURNING id", [t.id, b.adminName, b.email.toLowerCase(), hash])).rows[0]; await platformAudit(c, req.auth!.userId, t.id, 'tenant.created', b.reason, { adminId: u.id, unlimitedPilot: b.unlimitedPilot }); return t; });
    res.status(201).json(result);
}));
platformRouter.get('/tenants/:tenantId', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId);
    const data = await withPlatform(id, async (c) => { const t = await tenant(c, id); const users = (await c.query('SELECT id,name,email,role,status,department,station_or_machine,last_login_at FROM users WHERE tenant_id=$1 ORDER BY name', [id])).rows; const counts: Record<string, number> = {}; for (const table of PACKAGE_TABLES)
        counts[table] = (await c.query(`SELECT count(*)::int n FROM ${table} WHERE tenant_id=$1`, [id])).rows[0].n; const packages = (await c.query("SELECT id,kind,status,created_at,expires_at FROM platform_packages WHERE tenant_id=$1 AND actor_user_id=$2 ORDER BY created_at DESC LIMIT 20", [id, req.auth!.userId])).rows; await platformAudit(c, req.auth!.userId, id, 'tenant.viewed', 'Platform firma görüntüleme'); const events = (await c.query('SELECT id,action,reason,metadata,created_at,actor_user_id FROM platform_audit_events WHERE tenant_id=$1 ORDER BY id DESC LIMIT 50', [id])).rows; return { tenant: { ...t, unlimitedPilot: hasUnlimitedPilot(t) }, users, counts, events, packages }; });
    res.json(data);
}));
platformRouter.patch('/tenants/:tenantId', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), b = z.object({ unlimitedPilot: z.boolean(), suspended: z.boolean(), reason }).parse(req.body);
    if (id === req.auth!.tenantId && b.suspended)
        throw fail('Kendi platform giriş hesabınızın firmasını durduramazsınız.');
    await withPlatform(id, async (c) => { const before = await tenant(c, id); const after = (await c.query('UPDATE tenants SET pilot_unlimited=$2,platform_suspended=$3,updated_at=now() WHERE id=$1 RETURNING id,pilot_unlimited,platform_suspended', [id, b.unlimitedPilot, b.suspended])).rows[0]; await platformAudit(c, req.auth!.userId, id, 'tenant.access.updated', b.reason, { before: { pilot_unlimited: before.pilot_unlimited, platform_suspended: before.platform_suspended }, after }); });
    res.json({ ok: true });
}));
platformRouter.patch('/tenants/:tenantId/manual-subscription', wrap(async (req, res) => {
    const id=uuid.parse(req.params.tenantId);
    const b=z.object({plan:z.enum(['starter','pro','enterprise']),status:z.enum(['active','canceled']),endsAt:z.string().datetime({offset:true}),reason}).parse(req.body);
    if(b.status==='active' && Date.parse(b.endsAt)<=Date.now()) throw fail('Aktif lisans i\u00e7in biti\u015f tarihi gelecekte olmal\u0131.',400);
    await withPlatform(id, async c=>{
      const before=(await c.query('SELECT id,plan_id,subscription_status,billing_source,manual_license_ends_at,stripe_subscription_id FROM tenants WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!before) throw fail('Firma bulunamad\u0131.',404);
      if(before.stripe_subscription_id) throw fail('Stripe aboneli\u011fi ba\u011fl\u0131 hesap manuel olarak de\u011fi\u015ftirilemez.',409);
      const after=(await c.query("UPDATE tenants SET plan_id=$2,subscription_status=$3,billing_source='manual',manual_license_ends_at=$4,updated_at=now() WHERE id=$1 RETURNING plan_id,subscription_status,billing_source,manual_license_ends_at",[id,b.plan,b.status,b.endsAt])).rows[0];
      const {stripe_subscription_id: _stripe, ...safeBefore}=before;
      await platformAudit(c,req.auth!.userId,id,'tenant.manual_subscription.updated',b.reason,{before:safeBefore,after});
    });
    res.json({ok:true});
}));
platformRouter.post('/tenants/:tenantId/users', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), b = z.object({ id: z.string().optional(), name: z.string().min(2), email: z.string().email(), role: z.enum(['admin', 'quality_engineer', 'operator', 'auditor']), status: z.enum(['active', 'suspended']), password: z.string().min(12).max(72).refine(v => Buffer.byteLength(v) <= 72).optional(), reason }).parse(req.body);
    if (b.id && isPlatformAdmin(b.id))
        throw fail('Platform yöneticisi hesabı bu panelden değiştirilemez.');
    const hash = b.password ? await bcrypt.hash(b.password, 12) : null;
    const user = await withPlatform(id, async (c) => {
        await tenant(c, id);
        const old = b.id ? (await c.query('SELECT id,role,status FROM users WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [id, b.id])).rows[0] : null;
        if (b.id && !old)
            throw fail('Kullanıcı bulunamadı.', 404);
        if (!old && !hash)
            throw fail('Yeni kullanıcı için geçici şifre gerekli.', 400);
        if (old?.role === 'admin' && old.status === 'active' && (b.role !== 'admin' || b.status !== 'active')) {
            await c.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [id]);
            if (Number((await c.query("SELECT count(*) n FROM users WHERE tenant_id=$1 AND role='admin' AND status='active'", [id])).rows[0].n) <= 1)
                throw fail('Firmanın son aktif yöneticisi kaldırılamaz.');
        }
        const row = old ? (await c.query('UPDATE users SET name=$3,email=$4,role=$5,status=$6,password_hash=COALESCE($7,password_hash),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,name,email,role,status', [id, b.id, b.name, b.email.toLowerCase(), b.role, b.status, hash])).rows[0] : (await c.query('INSERT INTO users(id,tenant_id,name,email,role,status,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,status', [randomUUID(), id, b.name, b.email.toLowerCase(), b.role, b.status, hash])).rows[0];
        await platformAudit(c, req.auth!.userId, id, old ? 'user.updated' : 'user.created', b.reason, { userId: row.id, role: row.role, status: row.status, passwordReset: !!hash });
        return row;
    });
    res.json(user);
}));
platformRouter.get('/tenants/:tenantId/records/:table', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), table = packageTable(req.params.table), offset = z.coerce.number().int().min(0).parse(req.query.offset || 0);
    const result = await withPlatform(id, async (c) => { await tenant(c, id); if (offset === 0)
        await platformAudit(c, req.auth!.userId, id, 'data.read', 'Platform veri görüntüleme / export', { table }); const rows = (await c.query(`SELECT to_jsonb(t) data FROM ${table} t WHERE tenant_id=$1 ORDER BY ${table === 'inspection_approvals' ? 'inspection_id' : 'id'} LIMIT 51 OFFSET $2`, [id, offset])).rows.map(r => publicRow(table, r.data)); const selected: DataRow[] = []; let bytes = 0; for (const row of rows.slice(0, 50)) {
        const size = Buffer.byteLength(JSON.stringify(row));
        if (bytes + size > 1500000 && selected.length)
            break;
        selected.push(row);
        bytes += size;
    } return { rows: selected, next: rows.length > selected.length ? offset + selected.length : null }; });
    res.json(result);
}));
platformRouter.get('/tenants/:tenantId/media/:mediaId', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), mid = uuid.parse(req.params.mediaId);
    const media = await withPlatform(id, async (c) => { const row = (await c.query("SELECT * FROM media_evidence WHERE tenant_id=$1 AND id=$2 AND upload_status='ready'", [id, mid])).rows[0]; if (!row)
        throw fail('Dosya bulunamadı.', 404); await platformAudit(c, req.auth!.userId, id, 'media.accessed', 'Platform dosya görüntüleme', { mediaId: mid }); return row; });
    if (media.storage_provider === 'supabase') {
        if (!String(media.storage_path).startsWith(id + '/'))
            throw fail('Dosya yolu geçersiz.');
        const r = await supabaseStorage().createSignedUrl(media.storage_path, 300);
        if (r.error)
            throw r.error;
        res.json({ downloadUrl: r.data.signedUrl });
    }
    else {
        res.type(media.mime_type);
        res.sendFile(localFile(media.storage_path));
    }
}));
platformRouter.post('/tenants/:tenantId/backups', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), b = z.object({ id: uuid, reason }).parse(req.body);
    const manifest = await withPlatform(id, async (c) => { const previous = (await c.query('SELECT * FROM platform_packages WHERE id=$1', [b.id])).rows[0]; if (previous) {
        if (previous.actor_user_id !== req.auth!.userId || previous.tenant_id !== id || previous.kind !== 'backup')
            throw fail('İşlem kimliği başka pakete ait.');
        return previous.manifest;
    } const t = await tenant(c, id); await c.query("INSERT INTO platform_packages(id,tenant_id,actor_user_id,kind,reason) VALUES($1,$2,$3,'backup',$4)", [b.id, id, req.auth!.userId, b.reason]); const counts: Record<string, number> = {}; for (const table of PACKAGE_TABLES) {
        const result = await c.query(`INSERT INTO platform_package_rows(package_id,table_name,ordinal,row_data) SELECT $1,$2,(row_number() OVER())::integer-1,to_jsonb(t) FROM ${table} t WHERE tenant_id=$3`, [b.id, table, id]);
        counts[table] = result.rowCount || 0;
    } const media = await snapshotRows(c, b.id, 'media_evidence'); const data = { format: 'ritim-tenant', version: 1, tenant: t, schema: await schema(c), counts, files: media.filter(m => m.upload_status === 'ready').map(m => ({ id: m.id, size: m.size_bytes, mime: m.mime_type, sha256: '' })), createdAt: new Date().toISOString() }; await c.query("UPDATE platform_packages SET manifest=$2,status='ready' WHERE id=$1", [b.id, data]); await platformAudit(c, req.auth!.userId, id, 'backup.snapshot.created', b.reason, { packageId: b.id, counts }); return data; }, true);
    res.json({ id: b.id, manifest });
}));
platformRouter.get('/tenants/:tenantId/packages/:packageId/rows/:table', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), table = packageTable(req.params.table), offset = z.coerce.number().int().min(0).parse(req.query.offset || 0);
    const result = await withPlatform(id, async (c) => { await job(c, pid, req.auth!.userId, id); const rows = (await c.query('SELECT ordinal,row_data FROM platform_package_rows WHERE package_id=$1 AND table_name=$2 AND ordinal>=$3 ORDER BY ordinal LIMIT 51', [pid, table, offset])).rows; const selected: typeof rows = []; let size = 0; for (const row of rows.slice(0, 50)) {
        const bytes = Buffer.byteLength(JSON.stringify(row.row_data));
        if (size + bytes > 1500000 && selected.length)
            break;
        selected.push(row);
        size += bytes;
    } return { rows: selected.map(r => r.row_data), next: rows.length > selected.length ? selected[selected.length - 1].ordinal + 1 : null }; });
    res.json(result);
}));
platformRouter.get('/tenants/:tenantId/packages/:packageId/media/:mediaId', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), mid = uuid.parse(req.params.mediaId);
    const media = await withPlatform(id, async (c) => { await job(c, pid, req.auth!.userId, id, 'backup'); const row = (await c.query("SELECT row_data FROM platform_package_rows WHERE package_id=$1 AND table_name='media_evidence' AND row_data->>'id'=$2", [pid, mid])).rows[0]?.row_data; if (!row || row.upload_status !== 'ready')
        throw fail('Dosya bulunamadı.', 404); return row; });
    if (media.storage_provider === 'supabase') {
        if (!String(media.storage_path).startsWith(id + '/'))
            throw fail('Dosya yolu firmayla uyuşmuyor.');
        const r = await supabaseStorage().createSignedUrl(media.storage_path, 300);
        if (r.error)
            throw r.error;
        res.json({ downloadUrl: r.data.signedUrl });
    }
    else {
        res.type(media.mime_type);
        res.sendFile(localFile(media.storage_path));
    }
}));
platformRouter.post('/tenants/:tenantId/restores', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), b = z.object({ id: uuid, manifest: manifestSchema, reason }).parse(req.body);
    if (b.manifest.tenant.id !== id)
        throw fail('Bu yedek farklı firmaya ait. Hedef firmayı değiştirin.');
    if (Object.keys(b.manifest.counts).length !== PACKAGE_TABLES.length || PACKAGE_TABLES.some(t => b.manifest.counts[t] === undefined))
        throw fail('Yedek tablo listesi eksik.');
    if (new Set(b.manifest.files.map(f => f.id)).size !== b.manifest.files.length)
        throw fail('Yedekte tekrarlı dosya kimliği var.');
    await withPlatform(id, async (c) => { await tenant(c, id); if (canonical(await schema(c)) !== canonical(b.manifest.schema))
        throw fail('Yedek şema sürümü bu uygulamayla uyuşmuyor.'); const prior = (await c.query('SELECT * FROM platform_packages WHERE id=$1', [b.id])).rows[0]; if (prior) {
        if (prior.actor_user_id !== req.auth!.userId || prior.tenant_id !== id || canonical(prior.manifest) !== canonical(b.manifest))
            throw fail('Paket kimliği başka içeriğe ait.');
        return;
    } await c.query("INSERT INTO platform_packages(id,tenant_id,actor_user_id,kind,manifest,reason) VALUES($1,$2,$3,'restore',$4,$5)", [b.id, id, req.auth!.userId, b.manifest, b.reason]); await platformAudit(c, req.auth!.userId, id, 'restore.staging.created', b.reason, { packageId: b.id, counts: b.manifest.counts }); });
    res.json({ id: b.id });
}));
platformRouter.put('/tenants/:tenantId/packages/:packageId/rows/:table', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), table = packageTable(req.params.table), b = z.object({ offset: z.number().int().min(0), rows: z.array(z.record(z.unknown())).min(1).max(100) }).parse(req.body);
    await withPlatform(id, async (c) => { const j = await job(c, pid, req.auth!.userId, id, 'restore'); if (j.status !== 'staging')
        throw fail('Paket artık düzenlenemez.'); if (b.offset + b.rows.length > j.manifest.counts[table])
        throw fail('Yedek kayıt sayısı uyuşmuyor.'); await validatePackageRows(c, id, table, b.rows); for (let n = 0; n < b.rows.length; n++) {
        const old = (await c.query('SELECT row_data FROM platform_package_rows WHERE package_id=$1 AND table_name=$2 AND ordinal=$3', [pid, table, b.offset + n])).rows[0];
        if (old && canonical(old.row_data) !== canonical(b.rows[n]))
            throw fail('Aynı paket dilimi farklı veriyle gönderildi.');
        if (!old)
            await c.query('INSERT INTO platform_package_rows(package_id,table_name,ordinal,row_data) VALUES($1,$2,$3,$4)', [pid, table, b.offset + n, b.rows[n]]);
    } });
    res.json({ ok: true });
}));
platformRouter.post('/tenants/:tenantId/packages/:packageId/files/:mediaId', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), mid = uuid.parse(req.params.mediaId);
    const result = await withPlatform(id, async (c) => { const j = await job(c, pid, req.auth!.userId, id, 'restore'); if (j.status !== 'staging')
        throw fail('Paket artık düzenlenemez.'); const expected = j.manifest.files.find((f: {
        id: string;
    }) => f.id === mid); if (!expected)
        throw fail('Dosya yedek listesinde yok.'); const prior = (await c.query('SELECT * FROM platform_package_files WHERE package_id=$1 AND media_id=$2', [pid, mid])).rows[0]; const provider = usesSupabaseStorage() ? 'supabase' : 'local', path = prior?.storage_path || (provider === 'supabase' ? `${id}/restore-${pid}/${mid}` : `${id}-restore-${pid}-${mid}.bin`); if (!prior)
        await c.query('INSERT INTO platform_package_files(package_id,media_id,storage_provider,storage_path,sha256,size_bytes,mime_type) VALUES($1,$2,$3,$4,$5,$6,$7)', [pid, mid, provider, path, expected.sha256, expected.size, expected.mime]); if (provider === 'supabase' && !prior?.ready) {
        const r = await supabaseStorage().createSignedUploadUrl(path);
        if (r.error)
            throw r.error;
        return { provider, uploadUrl: r.data.signedUrl, ready: false };
    } return { provider, ready: !!prior?.ready }; });
    res.json(result);
}));
platformRouter.put('/tenants/:tenantId/packages/:packageId/files/:mediaId', raw({ type: 'application/octet-stream', limit: '8mb' }), wrap(async (req, res) => {
    if (usesSupabaseStorage())
        throw fail('Bulut dosyası için doğrudan yükleme adresini kullanın.');
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), mid = uuid.parse(req.params.mediaId);
    if (!Buffer.isBuffer(req.body))
        throw fail('Dosya içeriği eksik.', 400);
    await withPlatform(id, async (c) => { const j = await job(c, pid, req.auth!.userId, id, 'restore'); if (j.status !== 'staging')
        throw fail('Paket artık düzenlenemez.'); const f = (await c.query('SELECT * FROM platform_package_files WHERE package_id=$1 AND media_id=$2', [pid, mid])).rows[0]; if (!f || f.storage_provider !== 'local' || req.body.length !== f.size_bytes || digest(req.body) !== f.sha256)
        throw fail('Dosya boyutu veya özeti yedekle uyuşmuyor.'); await mkdir(mediaRoot, { recursive: true }); await writeFile(localFile(f.storage_path), req.body); await c.query('UPDATE platform_package_files SET ready=true WHERE package_id=$1 AND media_id=$2', [pid, mid]); });
    res.json({ ok: true });
}));
platformRouter.post('/tenants/:tenantId/packages/:packageId/files/:mediaId/complete', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), mid = uuid.parse(req.params.mediaId);
    await withPlatform(id, async (c) => { const j = await job(c, pid, req.auth!.userId, id, 'restore'); if (j.status !== 'staging')
        throw fail('Paket artık düzenlenemez.'); const f = (await c.query('SELECT * FROM platform_package_files WHERE package_id=$1 AND media_id=$2', [pid, mid])).rows[0]; if (!f)
        throw fail('Dosya bulunamadı.'); const bytes = f.storage_provider === 'supabase' ? await (async () => { const r = await supabaseStorage().download(f.storage_path); if (r.error)
        throw r.error; return Buffer.from(await r.data.arrayBuffer()); })() : await readFile(localFile(f.storage_path)); if (bytes.length !== f.size_bytes || digest(bytes) !== f.sha256)
        throw fail('Dosya bütünlüğü doğrulanamadı.'); await c.query('UPDATE platform_package_files SET ready=true WHERE package_id=$1 AND media_id=$2', [pid, mid]); });
    res.json({ ok: true });
}));
function occurrence(table: string, row: DataRow, seen: Map<string, number>) {
    if (!['audit_logs', 'quality_notifications'].includes(table))
        return 1;
    const { id, ...data } = row, key = table + canonical(data), n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n;
}
async function preview(client: pg.PoolClient, j: DataRow) {
    const manifest = j.manifest as PlatformManifest, id = String(j.id), counts: Record<string, {
        insert: number;
        keep: number;
        conflict: number;
    }> = {};
    let conflicts = 0;
    const seen = new Map<string, number>();
    const allRows: Record<string, DataRow[]> = {};
    for (const table of PACKAGE_TABLES) {
        const rows = await snapshotRows(client, id, table);
        allRows[table] = rows;
        if (rows.length !== manifest.counts[table])
            throw fail('Paket yüklemesi tamamlanmadı: ' + table);
        const c = { insert: 0, keep: 0, conflict: 0 };
        for (const row of rows) {
            const old = await existingRow(client, table, row, occurrence(table, row, seen));
            if (!old) {
                let collision = false;
                if (table === 'users')
                    collision = !!(await client.query('SELECT id FROM users WHERE tenant_id=$1 AND email=$2', [row.tenant_id, row.email])).rowCount;
                if (table === 'control_plans' && row.is_active)
                    collision = !!(await client.query('SELECT id FROM control_plans WHERE tenant_id=$1 AND product_id=$2 AND is_active', [row.tenant_id, row.product_id])).rowCount;
                if (collision) {
                    c.conflict++;
                    conflicts++;
                }
                else
                    c.insert++;
            }
            else if (conflictingRow(table, row, old)) {
                c.conflict++;
                conflicts++;
            }
            else
                c.keep++;
        }
        counts[table] = c;
    }
    await validatePackageReferences(client, String(j.tenant_id), allRows);
    const ready = (await client.query('SELECT media_id,size_bytes,mime_type FROM platform_package_files WHERE package_id=$1 AND ready=true', [id])).rows;
    if (ready.length !== manifest.files.length)
        throw fail('Yedek dosyalarının yüklemesi tamamlanmadı.');
    const media = await snapshotRows(client, id, 'media_evidence');
    if (media.filter(m => m.upload_status === 'ready').length !== manifest.files.length || manifest.files.some(f => !media.some(m => m.id === f.id && Number(m.size_bytes) === f.size && m.mime_type === f.mime && m.upload_status === 'ready')))
        throw fail('Yedek dosya envanteri uyuşmuyor.');
    return { counts, conflicts };
}
platformRouter.post('/tenants/:tenantId/packages/:packageId/preview', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId);
    const result = await withPlatform(id, async (c) => { const j = await job(c, pid, req.auth!.userId, id, 'restore'); if (j.status === 'applied')
        throw fail('Paket zaten uygulandı.'); const p = await preview(c, j); await c.query("UPDATE platform_packages SET status='ready' WHERE id=$1", [pid]); return p; });
    res.json(result);
}));
platformRouter.post('/tenants/:tenantId/packages/:packageId/apply', wrap(async (req, res) => {
    const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId), b = z.object({ confirmSlug: z.string(), reason }).parse(req.body);
    const result = await withPlatform(id, async (c) => {
        const t = await tenant(c, id);
        if (!t.platform_suspended)
            throw fail('Yükleme için önce firmayı geçici olarak durdurun.');
        if (t.slug !== b.confirmSlug)
            throw fail('Firma çalışma alanı adı eşleşmiyor.');
        const j = await job(c, pid, req.auth!.userId, id, 'restore');
        if (j.status === 'applied')
            return { alreadyApplied: true };
        if (j.status !== 'ready')
            throw fail('Önce içeriği doğrulayıp önizleyin.');
        await c.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [id]);
        const p = await preview(c, j);
        if (p.conflicts)
            throw fail('Ürün, plan veya ölçüm çakışmaları çözülmeden yükleme yapılamaz.');
        const seen = new Map<string, number>();
        for (const table of PACKAGE_TABLES) {
            for (const row of await snapshotRows(c, pid, table)) {
                const old = await existingRow(c, table, row, occurrence(table, row, seen));
                if (table === 'media_evidence' && row.upload_status === 'ready') {
                    const f = (await c.query('SELECT * FROM platform_package_files WHERE package_id=$1 AND media_id=$2 AND ready=true', [pid, row.id])).rows[0];
                    row.storage_path = f.storage_path;
                    row.storage_provider = f.storage_provider;
                    row.upload_expires_at = null;
                    if (old) {
                        await c.query("UPDATE media_evidence SET storage_path=$3,storage_provider=$4,upload_status='ready' WHERE tenant_id=$1 AND id=$2", [id, row.id, f.storage_path, f.storage_provider]);
                        continue;
                    }
                }
                if (!old)
                    await insertPackageRow(c, table, row);
            }
        }
        const max = (await c.query("SELECT COALESCE(max(substring(control_number from '^KNT-([0-9]+)$')::bigint),1000) n FROM inspection_logs WHERE tenant_id=$1", [id])).rows[0].n;
        await c.query('UPDATE tenants SET next_control_number=GREATEST(next_control_number,$2) WHERE id=$1', [id, max]);
        await c.query("UPDATE platform_packages SET status='applied' WHERE id=$1", [pid]);
        await platformAudit(c, req.auth!.userId, id, 'restore.applied', b.reason, { packageId: pid, ...p });
        return p;
    });
    res.json(result);
}));
platformRouter.delete('/tenants/:tenantId/packages/:packageId', wrap(async (req, res) => { const id = uuid.parse(req.params.tenantId), pid = uuid.parse(req.params.packageId); await withPlatform(id, async (c) => { const j = (await c.query('SELECT * FROM platform_packages WHERE id=$1 AND actor_user_id=$2 AND tenant_id=$3 FOR UPDATE', [pid, req.auth!.userId, id])).rows[0]; if (!j)
    throw fail('Paket bulunamadı.', 404); await discardPlatformPackage(c, j); }); res.json({ ok: true }); }));
