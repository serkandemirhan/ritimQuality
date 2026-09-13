import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, withDatabase } from './pool.js';

const adminName = process.env.ONPREM_ADMIN_NAME?.trim();
const adminEmail = process.env.ONPREM_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ONPREM_ADMIN_PASSWORD;
const companyName = process.env.ONPREM_COMPANY_NAME?.trim();

if (!adminName || !adminEmail || !adminPassword || adminPassword.length < 10) {
  throw new Error('ONPREM_ADMIN_NAME, ONPREM_ADMIN_EMAIL ve en az 10 karakterli ONPREM_ADMIN_PASSWORD zorunludur.');
}

try {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await withDatabase(async (client, tenantId) => {
    if (companyName) await client.query('UPDATE tenants SET name=$2,legal_name=$2,contact_email=$3,updated_at=now() WHERE id=$1',[tenantId,companyName,adminEmail]);
    await client.query(
    `INSERT INTO users(tenant_id,name,email,password_hash,role,department,status)
     VALUES($1,$2,$3,$4,'admin','Yönetim','active')
     ON CONFLICT(tenant_id,email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='admin',status='active',updated_at=now()`,
    [tenantId, adminName, adminEmail, passwordHash]);
  });
  console.log(`On-premise yönetici hesabı hazır: ${adminEmail}`);
} finally {
  await pool.end();
}
