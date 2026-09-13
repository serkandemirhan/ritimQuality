import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(join(here, 'seeds', 'demo.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Demo tenant and quality records seeded.');
} finally {
  await pool.end();
}
