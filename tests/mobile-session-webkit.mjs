import assert from 'node:assert/strict';
import {build} from 'esbuild';
import express from 'express';
import {webkit, devices} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const out=resolve('.runtime/mobile-webkit');
await mkdir(out,{recursive:true});
await build({entryPoints:['src/services/mobileMeasurement.ts'],bundle:true,format:'esm',platform:'browser',outfile:resolve(out,'core.js'),define:{'import.meta.env.VITE_API_URL':'"/api"'}});
const app=express();app.use(express.json({limit:'10mb'}));
const received=new Map();
let failFirst=true;
app.post('/api/inspection-logs',(req,res)=>{if(failFirst){failFirst=false;res.status(503).json({error:'Temporary network failure'});return;}if(req.body.id==='second'){res.status(409).json({error:'Plan changed',code:'INSPECTION_REJECTED_UNSAVED'});return;}const previous=received.get(req.body.id);if(!previous)received.set(req.body.id,req.body);res.json(previous||req.body);});
app.get('/api/media/config',(_req,res)=>res.json({provider:'local',maxBytes:8388608}));
let uploadedProof;
app.post('/api/media',(req,res)=>{uploadedProof=Buffer.from(req.body.dataUrl.split(',')[1],'base64').toString();res.json({id:req.body.id,fileName:req.body.fileName,mimeType:req.body.mimeType,kind:'photo',url:'/media/'+req.body.id,createdAt:new Date().toISOString()});});
app.get('/core.js',(_req,res)=>res.sendFile(resolve(out,'core.js')));
app.get('/',(_req,res)=>res.type('html').send('<!doctype html><title>Mobile storage</title>'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await webkit.launch();
try {
  const context=await browser.newContext({...devices['iPhone 13']});
  const a=await context.newPage(),b=await context.newPage(),origin=`http://127.0.0.1:${server.address().port}`;
  await Promise.all([a.goto(origin),b.goto(origin)]);
  const token='test.'+Buffer.from(JSON.stringify({tenantId:'review',userId:'user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
  await a.evaluate(token=>localStorage.setItem('qualitrack_access_token',token),token);
  await Promise.all([a.evaluate(async()=>{window.core=await import('/core.js');}),b.evaluate(async()=>{window.core=await import('/core.js');})]);
  const seed={id:'first',scope:'review:user',plan:{id:'plan',version:'v1',characteristics:[{id:'c1',pointNo:1,name:'Point',type:'numeric',nominal:10,lsl:9,usl:11,unit:'mm',pin:{x:50,y:50}}]},product:{id:'part',name:'Part',code:'P1'},count:1,operatorId:'user',operatorName:'Operator',orderNumber:'',lotNumber:'',serialNumber:'',instrumentId:'',source:'manual',active:{sample:1,characteristic:'c1'},order:'sample',drafts:{},attempts:[],media:{},createdAt:new Date().toISOString()};
  await a.evaluate(seed=>window.core.activateMobileDraft('review:user',seed,true),seed);
  await b.evaluate(seed=>window.core.activateMobileDraft('review:user',{...seed,id:'second'},true),seed);
  const result=await a.evaluate(async()=>{
    const core=window.core,cell={sample:1,characteristic:'c1'};
    const file=await core.packMobileFile(new File(['proof'],'proof.png',{type:'image/png'}));
    await core.changeStoredSession('review:user','first',s=>({...s,media:{photo:{id:'photo',file}}})).catch(e=>{throw new Error('initial-file-write: '+e.message)});
    const first=await core.commitMobileCell('review:user',cell,{...core.emptyDraft(),raw:'10',photos:['photo']},true,null,'first').catch(e=>{throw new Error('commit-with-file: '+e.message)});
    const updated=await core.commitMobileCell('review:user',cell,{...core.emptyDraft(),raw:'10.1'},true,null,'first');
    const local=await core.finishMobileSession('review:user','first');
    const current=await core.readMobileSession('review:user');
    const queue=await core.readMobileUploads('review:user');
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.includes('pending')||key.includes('inspection_logs'))throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};
    try{const failed=await core.syncMobileSession('review:user',queue[0]);const pending=await core.readMobileUploads('review:user');const synced=await core.syncMobileSession('review:user',pending[0]);return {first:first.attempts.length,attempts:updated.attempts.length,previous:updated.attempts[1].previousAttemptId,firstId:updated.attempts[0].id,reason:updated.attempts[1].retryReason,local:local.id,current:current.id,error:failed.syncError,pending:pending.length,confirmed:synced.confirmed?.id,remaining:(await core.readMobileUploads('review:user')).length};}
    finally{Storage.prototype.setItem=original;}
  });
  assert.equal(result.first,1);assert.equal(result.attempts,2);assert.equal(result.previous,result.firstId);assert.ok(result.reason);assert.equal(result.local,'first');assert.equal(result.current,'second');assert.equal(result.error,'Temporary network failure');assert.equal(result.pending,1);assert.equal(result.confirmed,'first');assert.equal(result.remaining,0);assert.equal(received.size,1);assert.equal(uploadedProof,'proof');
  const rejected=await b.evaluate(async()=>{const core=window.core;await core.commitMobileCell('review:user',{sample:1,characteristic:'c1'},{...core.emptyDraft(),raw:'10'},true,null,'second');await core.finishMobileSession('review:user','second');const queued=await core.readMobileUploads('review:user');const result=await core.syncMobileSession('review:user',queued[0]);return {locked:!!result.submissionRequested,error:result.syncError,drafts:(await core.listMobileDrafts('review:user')).map(s=>({id:s.id,attempts:s.attempts.length})),queue:(await core.readMobileUploads('review:user')).length};});
  assert.deepEqual(rejected,{locked:false,error:'Plan changed',drafts:[{id:'second',attempts:1}],queue:0});
  await context.close();
  console.log('PASS: WebKit two-tab takeover, concurrent attempts, durable completion and localStorage quota-independent upload');
} finally {await browser.close();await new Promise(r=>server.close(r));}
