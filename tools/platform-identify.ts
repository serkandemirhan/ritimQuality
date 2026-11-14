import 'dotenv/config';
import { pool, withTenant } from '../server/db/pool.js';
const args = process.argv.slice(2), value = (name: string) => args[args.indexOf(name) + 1];
const workspace = value('--workspace'), email = value('--email');
if (!workspace || !email || !args.includes('--workspace') || !args.includes('--email'))
    throw Error('Kullanım: npm run platform:identify -- --workspace kendi-alaniniz --email siz@example.com');
try {
    const tenant = (await pool.query('SELECT id,slug FROM tenants WHERE slug=$1', [workspace])).rows[0];
    if (!tenant)
        throw Error('Çalışma alanı bulunamadı.');
    const user = await withTenant(tenant.id, async (c) => (await c.query("SELECT id,name,role,status FROM users WHERE tenant_id=$1 AND email=$2", [tenant.id, email.toLowerCase()])).rows[0]);
    if (!user || user.status !== 'active')
        throw Error('Aktif kullanıcı bulunamadı.');
    console.log(JSON.stringify({ workspace: tenant.slug, userId: user.id, name: user.name, role: user.role, setting: 'PLATFORM_ADMIN_USER_IDS' }, null, 2));
}
finally {
    await pool.end();
}
