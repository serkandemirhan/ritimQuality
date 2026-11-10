import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {analyzeDrawing,calculateLimits,extractedSchema,parseDrawing} from '../server/services/drawingAnalysis.js';
import {planSchema} from '../server/services/inspectionValidation.js';

test('nine inch dimensions use deterministic general tolerance limits',()=>{
  const nominal=[.750,1.235,1.012,.508,1,1.995,3.015,4.008,5];
  const lower=[.745,1.230,1.007,.503,.995,1.990,3.010,4.003,4.995];
  const upper=[.755,1.240,1.017,.513,1.005,2,3.020,4.013,5.005];
  nominal.forEach((n,i)=>assert.deepEqual(calculateLimits({nominal:n,tolerancePlus:.005,toleranceMinus:-.005,lowerLimit:null,upperLimit:null}),{lower:lower[i],upper:upper[i]}));
});
test('asymmetric signed tolerances, explicit limits and missing information',()=>{
  assert.deepEqual(calculateLimits({nominal:10,tolerancePlus:.02,toleranceMinus:-.01}),{lower:9.99,upper:10.02});
  assert.deepEqual(calculateLimits({nominal:10,tolerancePlus:.02,toleranceMinus:.01}),{lower:10.01,upper:10.02});
  assert.deepEqual(calculateLimits({lowerLimit:5,upperLimit:6}),{lower:5,upper:6});
  assert.equal(calculateLimits({nominal:10}),null);
  assert.equal(calculateLimits({nominal:10,toleranceMinus:.1,tolerancePlus:-.1}),null);
});
test('malformed and incomplete model outputs fail schema validation',()=>{
  assert.equal(extractedSchema.safeParse({characteristics:[{nominal:10}]}).success,false);
  assert.equal(extractedSchema.safeParse({notes:[],characteristics:[],extra:'unexpected'}).success,false);
  assert.equal(extractedSchema.safeParse({notes:['Datum A'],characteristics:[]}).success,true);
});
test('real PDF parsing excludes page two and preserves text source coordinates',async()=>{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([600,400]).drawText('LENGTH 10.000 +/- 0.005 INCH',{x:100,y:200,font,size:12});
  pdf.addPage([600,400]).drawText('SECRET PAGE TWO',{x:20,y:200,font,size:12});
  const parsed=await parseDrawing(Buffer.from(await pdf.save()));
  assert.equal(parsed.pageCount,2);
  assert.equal((await PDFDocument.load(parsed.firstBytes)).getPageCount(),1);
  assert.ok(parsed.sources.some(s=>s.text.includes('10.000')));
  assert.ok(!parsed.sources.some(s=>s.text.includes('SECRET')));
  assert.ok(parsed.sources.every(s=>s.box.x>=0&&s.box.x<100&&s.box.y>=0&&s.box.y<100));
  await assert.rejects(parseDrawing(Buffer.from('not a pdf')));
});
test('existing plan schema preserves analysis and source metadata in a draft',()=>{
  const plan=planSchema.parse({id:'p',productId:'part',version:'v1',status:'draft',isActive:false,drawingAnalysis:{pageCount:2,analyzedPage:1},characteristics:[{id:'c',pointNo:1,name:'Çap',nominal:.75,lsl:.745,usl:.755,unit:'inch',extraction:{sourcePage:1,verificationStatus:'verified'}}]});
  assert.equal(plan.isActive,false);assert.equal(plan.characteristics[0].unit,'inch');assert.deepEqual(plan.drawingAnalysis,{pageCount:2,analyzedPage:1});
});

test('AI transport sends only page one, preserves missing values, rejects invalid source IDs',async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const bytes=Buffer.from(await pdf.save());
  const originalFetch=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='offline-test-only';
  try{
    globalThis.fetch=async(_url,options)=>{
      const request=JSON.parse(String(options?.body));
      const sent=Buffer.from(request.input[0].content[0].file_data.split(',')[1],'base64');
      assert.equal((await PDFDocument.load(sent)).getPageCount(),1);assert.equal(request.store,false);
      return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({notes:[],characteristics:[{description:'Çap',characteristicType:'diameter',originalText:'10',sourceId:999,nominal:10,unit:null,tolerancePlus:null,toleranceMinus:null,lowerLimit:null,upperLimit:null,toleranceSource:null,suggestedInstrument:'Diğer Ölçüm Aleti'}]})}]}],usage:{input_tokens:10,output_tokens:10}}));
    };
    const result=await analyzeDrawing(bytes);assert.equal(result.characteristics[0].sourceBoundingBox,null);assert.equal(result.characteristics[0].lowerLimit,null);assert.equal(result.characteristics[0].unit,null);assert.equal(result.characteristics[0].verificationStatus,'needs_review');
    globalThis.fetch=async()=>new Response('{}',{status:401});await assert.rejects(analyzeDrawing(bytes),/anahtarı geçersiz/);
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'incomplete'}));await assert.rejects(analyzeDrawing(bytes),/tamamlanamadı/);
  }finally{globalThis.fetch=originalFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});

test('plan persistence rejects unverified AI measurements',()=>{
  assert.equal(planSchema.safeParse({id:'p',productId:'part',version:'v1',status:'draft',isActive:false,characteristics:[{id:'c',pointNo:1,name:'Çap',nominal:10,lsl:9,usl:11,extraction:{verificationStatus:'needs_review'}}]}).success,false);
});
