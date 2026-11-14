import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPlatformAdmin,requirePlatformAdmin} from '../server/middleware/platform';
import {publicRow,packageTable,conflictingRow,canonical} from '../server/services/platformPackage';
import {encryptTenantArchive,decryptTenantArchive} from '../src/services/platformArchive';
import {hasUnlimitedPilot} from '../server/services/pilotAccess';
import type {TenantArchive} from '../src/services/platformApi';

test('platform access requires explicit immutable user ID; ordinary admin role is not sufficient',()=>{
 assert.equal(isPlatformAdmin('owner','owner,other'),true);assert.equal(isPlatformAdmin('own','owner'),false);assert.equal(isPlatformAdmin('customer-admin',''),false);assert.equal(isPlatformAdmin(undefined,'owner'),false);
 const old=process.env.PLATFORM_ADMIN_USER_IDS;process.env.PLATFORM_ADMIN_USER_IDS='owner';let code=0,next=false;
 const response={status:(value:number)=>{code=value;return response;},json:()=>undefined};requirePlatformAdmin({auth:{userId:'customer',role:'admin'}} as any,response as any,()=>{next=true;});assert.equal(code,403);assert.equal(next,false);
 requirePlatformAdmin({auth:{userId:'owner',role:'admin'}} as any,response as any,()=>{next=true;});assert.equal(next,true);if(old===undefined)delete process.env.PLATFORM_ADMIN_USER_IDS;else process.env.PLATFORM_ADMIN_USER_IDS=old;
});
test('record viewer/export recursively removes account secrets',()=>{
 const row=publicRow('audit_logs',{id:1,password_hash:'hash',before_data:{password_hash:'nested',token_hash:'token',name:'Normal'},payload:{session_version:3,value:10}});
 assert.deepEqual(row,{id:1,before_data:{name:'Normal'},payload:{value:10}});
});
test('package tables are fixed; SQL fragments cannot become dataset names',()=>{assert.equal(packageTable('products'),'products');for(const name of ['tenants','account_tokens','products;DROP TABLE users','platform_packages'])assert.throws(()=>packageTable(name));});
test('master revision and measurement conflicts are distinguished from mutable account metadata',()=>{
 assert.equal(conflictingRow('control_plans',{payload:{a:1,b:2}},{payload:{b:2,a:1}}),false);assert.equal(conflictingRow('inspection_logs',{payload:{value:10}},{payload:{value:11}}),true);assert.equal(conflictingRow('users',{password_hash:'old'},{password_hash:'new'}),false);assert.equal(canonical({b:[2],a:1}),canonical({a:1,b:[2]}));
});
test('database pilot preference can override an environment allowlist in either direction',()=>{
 const old=process.env.UNLIMITED_PILOT_WORKSPACES;process.env.UNLIMITED_PILOT_WORKSPACES='factory-a';assert.equal(hasUnlimitedPilot({slug:'factory-a',pilot_unlimited:false}),false);assert.equal(hasUnlimitedPilot({slug:'factory-b',pilot_unlimited:true}),true);assert.equal(hasUnlimitedPilot({slug:'factory-a',pilot_unlimited:null}),true);if(old===undefined)delete process.env.UNLIMITED_PILOT_WORKSPACES;else process.env.UNLIMITED_PILOT_WORKSPACES=old;
});
const archive={manifest:{format:'ritim-tenant',version:1,tenant:{id:'tenant-a',slug:'factory-a',name:'Örnek Fabrika'},schema:['v1'],counts:{users:1},files:[],createdAt:'2026-11-10T00:00:00Z'},rows:{users:[{id:'one',password_hash:'private-backup-hash',name:'İpek'}]},media:{}} as TenantArchive;
test('encrypted archive roundtrip preserves Unicode and password hashes without exposing them in the file',async()=>{
 const file=new File([await encryptTenantArchive(archive,'Correct test passphrase')],'example.ritimbackup');const content=await file.text();assert.equal(content.includes('private-backup-hash'),false);assert.equal(content.includes('Örnek Fabrika'),false);assert.deepEqual(await decryptTenantArchive(file,'Correct test passphrase'),archive);
});
test('wrong passwords, changed ciphertext and changed headers fail authentication',async()=>{
 const blob=await encryptTenantArchive(archive,'Correct test passphrase');const file=new File([blob],'example.ritimbackup');await assert.rejects(()=>decryptTenantArchive(file,'Wrong test passphrase'));
 const data=JSON.parse(await blob.text());data.compression=data.compression==='gzip'?'none':'gzip';await assert.rejects(()=>decryptTenantArchive(new File([JSON.stringify(data)],'tampered.ritimbackup'),'Correct test passphrase'));
});
test('backup creation requires a proper passphrase',async()=>{await assert.rejects(()=>encryptTenantArchive(archive,'short'));});
