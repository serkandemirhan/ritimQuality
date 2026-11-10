import type pg from 'pg';
import { createHash } from 'node:crypto';
/** These are application data only. Tokens, push subscriptions and Stripe state are not portable backups. */
export const PACKAGE_TABLES = ['plants', 'departments', 'stations', 'users', 'products', 'control_plans', 'inspection_logs', 'measurement_results', 'inspection_drafts', 'media_evidence', 'quality_cases', 'inspection_approvals', 'quality_tasks', 'quality_notifications', 'audit_logs'] as const;
export type PackageTable = typeof PACKAGE_TABLES[number];
export type DataRow = Record<string, unknown>;
export interface PlatformManifest {
    format: 'ritim-tenant';
    version: 1;
    tenant: {
        id: string;
        slug: string;
        name: string;
        [key: string]: unknown;
    };
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
export function packageTable(value: string): PackageTable { if (!(PACKAGE_TABLES as readonly string[]).includes(value))
    throw Object.assign(Error('Veri türü desteklenmiyor.'), { status: 400 }); return value as PackageTable; }
export function publicRow(table: string, row: DataRow): DataRow {
    const redact = (value: unknown): unknown => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|secret|access_token|refresh_token|token_hash|session_version)/i.test(key)).map(([key, v]) => [key, redact(v)])) : value;
    return redact(row) as DataRow;
}
const keyColumns: Record<string, string[]> = { measurement_results: ['tenant_id', 'inspection_id', 'sample_index', 'characteristic_id'], inspection_approvals: ['tenant_id', 'inspection_id'] };
const generated = new Set(['measurement_results', 'quality_notifications', 'audit_logs']);
export async function existingRow(client: pg.PoolClient, table: PackageTable, row: DataRow, occurrence = 1): Promise<DataRow | undefined> {
    if (table === 'audit_logs' || table === 'quality_notifications')
        return (await client.query(`SELECT * FROM ${table} t WHERE tenant_id=$1 AND (to_jsonb(t)-'id')=($2::jsonb-'id') ORDER BY id OFFSET $3 LIMIT 1`, [row.tenant_id, JSON.stringify(row), occurrence - 1])).rows[0];
    const keys = keyColumns[table] || ['tenant_id', 'id'];
    return (await client.query(`SELECT * FROM ${table} WHERE ${keys.map((key, i) => `"${key}"=$${i + 1}`).join(' AND ')} LIMIT 1`, keys.map(key => row[key]))).rows[0];
}
export function conflictingRow(table: PackageTable, incoming: DataRow, current: DataRow): boolean {
    if (['products', 'control_plans', 'inspection_logs'].includes(table))
        return canonical(incoming.payload) !== canonical(current.payload);
    if (table === 'media_evidence')
        return incoming.mime_type !== current.mime_type || Number(incoming.size_bytes) !== Number(current.size_bytes);
    return false;
}
export function canonical(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
    return JSON.stringify(value);
}
export async function validatePackageRows(client: pg.PoolClient, tenantId: string, table: PackageTable, rows: DataRow[]) {
    const metadata = (await client.query("SELECT column_name,is_nullable,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table])).rows;
    const columns = new Set(metadata.map(row => row.column_name));
    for (const row of rows) {
        if (row.tenant_id !== tenantId)
            throw Object.assign(Error('Yedek farklı firmaya ait kayıt içeriyor.'), { status: 409 });
        if (metadata.some(col => !(col.column_name in row) || row[col.column_name] === null && col.is_nullable === 'NO' && col.data_type !== 'jsonb'))
            throw Object.assign(Error('Yedek kayıt alanları eksik veya boş.'), { status: 409 });
        if (Object.keys(row).some(key => !columns.has(key)))
            throw Object.assign(Error('Yedek alanları mevcut şemayla uyuşmuyor.'), { status: 409 });
        if ((table === 'inspection_approvals' ? !row.inspection_id : row.id === undefined) || row.id === null)
            throw Object.assign(Error('Yedek kayıt kimliği eksik.'), { status: 400 });
    }
}
export async function insertPackageRow(client: pg.PoolClient, table: PackageTable, row: DataRow) {
    const input = { ...row };
    if (generated.has(table))
        delete input.id;
    if (table === 'users')
        input.session_version = Number(input.session_version || 0) + 1;
    const columns = Object.keys(input).filter(key => /^[a-z_]+$/.test(key));
    if (columns.length !== Object.keys(input).length)
        throw Error('Invalid column');
    const names = columns.map(key => '"' + key + '"').join(',');
    const jsonFields: Record<string, string[]> = { products: ['payload'], control_plans: ['payload'], inspection_logs: ['payload'], measurement_results: ['value'], inspection_drafts: ['payload'] };
    const selected = columns.map(key => jsonFields[table]?.includes(key) ? `$1::jsonb->'${key}'` : '"' + key + '"').join(',');
    await client.query(`INSERT INTO ${table} (${names}) SELECT ${selected} FROM jsonb_populate_record(NULL::${table},$1::jsonb)`, [JSON.stringify(input)]);
}
export const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Check restored references against both the package and retained customer rows, before any live write. */
export async function validatePackageReferences(client: pg.PoolClient, tenantId: string, rowsByTable: Record<string, DataRow[]>) {
    const constraints = (await client.query(`SELECT child.relname child_table,parent.relname parent_table,
 array_agg(ca.attname::text ORDER BY keys.n) child_columns,array_agg(pa.attname::text ORDER BY keys.n) parent_columns
 FROM pg_constraint f JOIN pg_class child ON child.oid=f.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace
 JOIN pg_class parent ON parent.oid=f.confrelid
 JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY keys(cnum,pnum,n) ON true
 JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=keys.cnum
 JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=keys.pnum
 WHERE f.contype='f' AND ns.nspname='public' AND child.relname=ANY($1)
 GROUP BY f.oid,child.relname,parent.relname`, [[...PACKAGE_TABLES]])).rows;
    for (const fk of constraints) {
        if (![...PACKAGE_TABLES, 'tenants'].includes(fk.parent_table))
            throw Object.assign(Error('Desteklenmeyen yedek ilişkisi.'), { status: 409 });
        const cols = fk.parent_columns as string[], childCols = fk.child_columns as string[];
        if ([...cols, ...childCols].some(col => !/^[a-z_]+$/.test(col)))
            throw Error('Invalid FK column');
        const existing = (await client.query(`SELECT ${cols.map(c => '"' + c + '"').join(',')} FROM ${fk.parent_table} WHERE ${fk.parent_table === 'tenants' ? 'id' : 'tenant_id'}=$1`, [tenantId])).rows;
        const signature = (row: DataRow, columns: string[]) => JSON.stringify(columns.map(col => String(row[col])));
        const allowed = new Set([...existing, ...(rowsByTable[fk.parent_table] || [])].map(row => signature(row, cols)));
        for (const row of rowsByTable[fk.child_table] || []) {
            if (childCols.some(col => row[col] === null || row[col] === undefined))
                continue;
            if (!allowed.has(signature(row, childCols)))
                throw Object.assign(Error(`Yedekte eksik veya başka firmaya ait ilişki var: ${fk.child_table}.`), { status: 409 });
        }
    }
}
