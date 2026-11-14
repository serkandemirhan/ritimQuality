const fs=require('fs'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const {chromium}=require('D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const {PDFDocument}=require('pdf-lib');const out='.runtime/three-device-acceptance',results=[];
const adb='C:/Users/serkan/AppData/Local/Android/Sdk/platform-tools/adb.exe';
(async()=>{for(const [id,serial,port]of[['T1','R5CTB21F4LH',9223],['T2','RFCRC1R150K',9224]]){
 const b=await chromium.connectOverCDP('http://127.0.0.1:'+port);try{const p=b.contexts()[0].pages().findLast(p=>p.url().startsWith('http://localhost:3000'));assert.ok(p);await p.bringToFront();
 await p.evaluate(()=>{window.__qaDownloaded=null;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type==='application/pdf')b.arrayBuffer().then(bytes=>{window.__qaDownloaded={name:b.name||'report.pdf',bytes:Array.from(new Uint8Array(bytes))};});return original(b);};});
 const l=p.getByRole('button',{name:'PDF indir',exact:true});await l.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(400);const r=await l.boundingBox();const c=await p.context().newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await p.waitForFunction(()=>!!window.__qaDownloaded,{timeout:20000});
 const file=await p.evaluate(()=>window.__qaDownloaded);const bytes=Buffer.from(file.bytes);assert.equal(bytes.subarray(0,4).toString(),'%PDF');const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=1);fs.writeFileSync(out+'/'+id+'-physical-report.pdf',bytes);
 await p.screenshot({path:out+'/'+id+'-pdf-download.png'});
 const files=execFileSync(adb,['-s',serial,'shell','ls','-t','/sdcard/Download'],{encoding:'utf8'}).split(/\r?\n/).filter(s=>s.startsWith('Ritim_Kalite_')&&s.endsWith('.pdf')).slice(0,5);
 results.push({id:'SHARE-01-generated-file',device:id,status:'Geçti',bytes:bytes.length,pages:pdf.getPageCount(),name:file.name,androidDownloadCandidates:files,nativeFilesAppOpened:false,whatsAppSent:false});console.log('PASS PDF '+id+' '+bytes.length+' bytes, '+pdf.getPageCount()+' pages');
 }finally{await b.close();}}
})().catch(e=>{results.push({status:'Kaldı',error:e.message});console.error(e.message);process.exitCode=1;}).finally(()=>fs.writeFileSync(out+'/pdf-results.json',JSON.stringify(results,null,2)));
