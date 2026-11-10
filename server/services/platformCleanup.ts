import { unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type pg from 'pg';
import { supabaseStorage } from './mediaStorage.js';
import { withPlatform } from './platformContext.js';
const mediaRoot = resolve(process.env.MEDIA_ROOT || '.data/media');
/** Only unused objects created by this exact staging job may be removed. */
export async function discardPlatformPackage(client: pg.PoolClient, job: {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
}) {
    if (job.kind === 'restore' && job.status !== 'applied') {
        await client.query("SELECT set_config('app.tenant_id',$1,true)", [job.tenant_id]);
        const files = (await client.query('SELECT * FROM platform_package_files WHERE package_id=$1', [job.id])).rows;
        for (const f of files) {
            if ((await client.query('SELECT 1 FROM media_evidence WHERE tenant_id=$1 AND storage_path=$2', [job.tenant_id, f.storage_path])).rowCount)
                continue;
            if (f.storage_provider === 'supabase') {
                if (!String(f.storage_path).startsWith(`${job.tenant_id}/restore-${job.id}/`))
                    throw Error('Unsafe staging object');
                const result = await supabaseStorage().remove([f.storage_path]);
                if (result.error)
                    throw result.error;
            }
            else {
                if (!String(f.storage_path).startsWith(`${job.tenant_id}-restore-${job.id}-`))
                    throw Error('Unsafe staging file');
                const path = resolve(mediaRoot, f.storage_path);
                if (!path.startsWith(mediaRoot + sep))
                    throw Error('Unsafe local staging path');
                try {
                    await unlink(path);
                }
                catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                        throw error;
                }
            }
        }
    }
    await client.query('DELETE FROM platform_packages WHERE id=$1', [job.id]);
}
export async function cleanupExpiredPlatformPackages() { return withPlatform(null, async (c) => { const jobs = (await c.query('SELECT * FROM platform_packages WHERE expires_at<now() ORDER BY expires_at LIMIT 20 FOR UPDATE SKIP LOCKED')).rows; for (const j of jobs)
    await discardPlatformPackage(c, j); return jobs.length; }); }
