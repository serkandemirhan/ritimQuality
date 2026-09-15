import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const fixture=JSON.parse(await readFile('.runtime/quality-test-fixture.json','utf8'));
const ownerUrl=new URL(fixture.connectionString);ownerUrl.username='quality_test_owner';
const pool=new pg.Pool({connectionString:ownerUrl.toString()});
try{
  const sql=await readFile('supabase/apply-sales-revisions.sql','utf8');
  for(let attempt=0;attempt<2;attempt++){
    const result=await pool.query(sql),verification=result.at(-1).rows[0];
    assert.deepEqual(verification,{stations_ready:true,drafts_ready:true,visual_measurements_ready:true});
  }
  console.log('PASS: combined Supabase query is idempotent');
}finally{await pool.end();}
