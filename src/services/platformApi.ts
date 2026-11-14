import { toBase64, fromBase64, sha256, buffer } from './platformArchive';
export { encryptTenantArchive, decryptTenantArchive } from './platformArchive';
import { platformRequest, SaasApi } from './api';
export type Row = Record<string, any>;
export const PLATFORM_TABLES = ['plants', 'departments', 'stations', 'users', 'products', 'control_plans', 'inspection_logs', 'measurement_results', 'inspection_drafts', 'media_evidence', 'quality_cases', 'inspection_approvals', 'quality_tasks', 'quality_notifications', 'audit_logs'] as const;
export const TABLE_LABELS: Record<string, string> = { plants: 'Tesisler', departments: 'Bölümler', stations: 'İstasyonlar', users: 'Kullanıcılar', products: 'Parçalar', control_plans: 'Kontrol planları', inspection_logs: 'Ölçüm kayıtları', measurement_results: 'Ölçüm sonuçları', inspection_drafts: 'Sunucu taslakları', media_evidence: 'Teknik resim ve kanıtlar', quality_cases: 'Uygunsuzluklar', inspection_approvals: 'Onaylar', quality_tasks: 'Görevler', quality_notifications: 'Bildirim geçmişi', audit_logs: 'Denetim izi' };
export interface Manifest {
    format: 'ritim-tenant';
    version: 1;
    tenant: Row;
    schema: string[];
    counts: Record<string, number>;
    files: {
        id: string;
        size: number;
        mime: string;
        sha256: string;
    }[];
    createdAt: string;
}
export interface TenantArchive {
    manifest: Manifest;
    rows: Record<string, Row[]>;
    media: Record<string, string>;
}
export interface TenantDetail {
    tenant: Row;
    users: Row[];
    counts: Record<string, number>;
    events: Row[];
    packages?: Row[];
}
const root = (id: string) => '/platform/tenants/' + encodeURIComponent(id);
export const PlatformApi = {
    me: () => platformRequest<{
        userId: string;
        tenantId: string;
    }>('/platform/me'),
    list: (q = '', after = '') => platformRequest<{
        tenants: Row[];
        next: string | null;
    }>('/platform/tenants?q=' + encodeURIComponent(q) + '&after=' + encodeURIComponent(after)),
    detail: (id: string) => platformRequest<TenantDetail>(root(id)),
    create: (body: Row) => platformRequest<Row>('/platform/tenants', { method: 'POST', body: JSON.stringify(body) }),
    access: (id: string, body: Row) => platformRequest(root(id), { method: 'PATCH', body: JSON.stringify(body) }),
    user: (id: string, body: Row) => platformRequest(root(id) + '/users', { method: 'POST', body: JSON.stringify(body) }),
    records: (id: string, table: string, offset = 0) => platformRequest<{
        rows: Row[];
        next: number | null;
    }>(root(id) + '/records/' + table + '?offset=' + offset),
    snapshot: (id: string, reason: string) => platformRequest<{
        id: string;
        manifest: Manifest;
    }>(root(id) + '/backups', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), reason }) }),
    packageRows: (id: string, pid: string, table: string, offset = 0) => platformRequest<{
        rows: Row[];
        next: number | null;
    }>(root(id) + '/packages/' + pid + '/rows/' + table + '?offset=' + offset),
    restore: (id: string, manifest: Manifest, reason: string) => platformRequest<{
        id: string;
    }>(root(id) + '/restores', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), manifest, reason }) }),
    uploadRows: (id: string, pid: string, table: string, offset: number, rows: Row[]) => platformRequest(root(id) + '/packages/' + pid + '/rows/' + table, { method: 'PUT', body: JSON.stringify({ offset, rows }) }),
    preview: (id: string, pid: string) => platformRequest<{
        counts: Record<string, {
            insert: number;
            keep: number;
            conflict: number;
        }>;
        conflicts: number;
    }>(root(id) + '/packages/' + pid + '/preview', { method: 'POST' }),
    apply: (id: string, pid: string, confirmSlug: string, reason: string) => platformRequest(root(id) + '/packages/' + pid + '/apply', { method: 'POST', body: JSON.stringify({ confirmSlug, reason }) }),
    remove: (id: string, pid: string) => platformRequest(root(id) + '/packages/' + pid, { method: 'DELETE' }),
    logout: SaasApi.logout,
};
export function downloadFile(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function mediaBytes(route: string): Promise<Uint8Array> {
    const response = await fetch((import.meta.env.VITE_API_URL || '/api') + route, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('qualitrack_access_token') || '') } });
    if (!response.ok)
        throw Error('Dosya alınamadı; yedek tamamlanmadı.');
    if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        const file = await fetch(data.downloadUrl);
        if (!file.ok)
            throw Error('Yedek dosyası indirilemedi.');
        return new Uint8Array(await file.arrayBuffer());
    }
    return new Uint8Array(await response.arrayBuffer());
}
export async function openTenantMedia(id: string, mediaId: string, name: string) { const bytes = await mediaBytes(root(id) + '/media/' + mediaId); downloadFile(new Blob([bytes as Uint8Array<ArrayBuffer>]), name); }
export async function collectTenantBackup(id: string, reason: string, progress: (message: string) => void): Promise<TenantArchive> {
    const { id: pid, manifest } = await PlatformApi.snapshot(id, reason), rows: Record<string, Row[]> = {}, media: Record<string, string> = {};
    try {
        for (const table of PLATFORM_TABLES) {
            progress(TABLE_LABELS[table] + ' alınıyor…');
            rows[table] = [];
            let offset: number | null = 0;
            do {
                const page = await PlatformApi.packageRows(id, pid, table, offset);
                rows[table].push(...page.rows);
                offset = page.next;
            } while (offset !== null);
            if (rows[table].length !== manifest.counts[table])
                throw Error('Yedek kayıt sayısı uyuşmuyor.');
        }
        for (let i = 0; i < manifest.files.length; i++) {
            const file = manifest.files[i];
            progress(`Dosya ${i + 1} / ${manifest.files.length} alınıyor…`);
            const bytes = await mediaBytes(root(id) + '/packages/' + pid + '/media/' + file.id);
            if (bytes.length !== file.size)
                throw Error('Yedek dosya boyutu uyuşmuyor.');
            file.sha256 = await sha256(bytes);
            media[file.id] = toBase64(bytes);
        }
        return { manifest, rows, media };
    }
    finally {
        await PlatformApi.remove(id, pid).catch(() => undefined);
    }
}
export async function stageTenantRestore(id: string, archive: TenantArchive, reason: string, progress: (message: string) => void) {
    if (archive.manifest.tenant.id !== id)
        throw Error('Bu yedek farklı firmaya ait.');
    for (const file of archive.manifest.files) {
        const data = archive.media[file.id];
        if (typeof data !== 'string')
            throw Error('Yedekte dosya eksik.');
        const bytes = fromBase64(data);
        if (bytes.length !== file.size || await sha256(bytes) !== file.sha256)
            throw Error('Yedek dosya bütünlüğü uyuşmuyor.');
    }
    const { id: pid } = await PlatformApi.restore(id, archive.manifest, reason);
    try {
        for (const table of PLATFORM_TABLES) {
            const rows = archive.rows[table];
            if (!Array.isArray(rows) || rows.length !== archive.manifest.counts[table])
                throw Error('Yedek kayıt sayısı eksik: ' + table);
            progress(TABLE_LABELS[table] + ' doğrulanıyor…');
            let offset = 0;
            while (offset < rows.length) {
                const batch: Row[] = [];
                let bytes = 0;
                while (offset + batch.length < rows.length && batch.length < 50) {
                    const row = rows[offset + batch.length], size = new TextEncoder().encode(JSON.stringify(row)).length;
                    if (bytes + size > 700000 && batch.length)
                        break;
                    if (size > 2500000)
                        throw Error('Tek kayıt yükleme sınırını aşıyor.');
                    batch.push(row);
                    bytes += size;
                }
                await PlatformApi.uploadRows(id, pid, table, offset, batch);
                offset += batch.length;
            }
        }
        for (let i = 0; i < archive.manifest.files.length; i++) {
            const file = archive.manifest.files[i], route = root(id) + '/packages/' + pid + '/files/' + file.id;
            progress(`Dosya ${i + 1} / ${archive.manifest.files.length} doğrulanıyor…`);
            const target = await platformRequest<{
                provider: string;
                uploadUrl?: string;
                ready: boolean;
            }>(route, { method: 'POST' });
            if (!target.ready) {
                const bytes = fromBase64(archive.media[file.id]);
                if (target.provider === 'supabase') {
                    const r = await fetch(target.uploadUrl!, { method: 'PUT', headers: { 'Content-Type': file.mime }, body: buffer(bytes) });
                    if (!r.ok)
                        throw Error('Yedek dosyası yüklenemedi.');
                }
                else
                    await platformRequest(route, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: buffer(bytes) });
                await platformRequest(route + '/complete', { method: 'POST' });
            }
        }
        return { id: pid, preview: await PlatformApi.preview(id, pid) };
    }
    catch (error) {
        await PlatformApi.remove(id, pid).catch(() => undefined);
        throw error;
    }
}
