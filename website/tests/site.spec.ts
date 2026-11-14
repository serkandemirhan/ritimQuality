import {processingScope} from '../lib/processing-scope';
import {test,expect} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {displayNumber,extractDimensions,numeric,parseMeasurementInput,verdict,type SourceText} from '../lib/drawing-demo';
import {originalBox} from '../lib/drawing-ocr';
import {drawingRules,isoTolerance} from '../lib/drawing-tolerances';
import {placeMarkers} from '../lib/drawing-markers';
import {plusMinusGlyph} from '../lib/ocr-symbols';
import {textBounds} from '../lib/drawing-regions';
import {validateAnalyzedPoints} from '../lib/validate-demo-plan';
import {initialReportMetadata,withDemoMetadata} from '../lib/report-metadata';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {analyzeDemoReport,demoReportRowValues,measurementDeviation} from '../lib/demo-report-analysis';
import {demoDofNumber} from '../lib/demo-report-pdf';

test('demo PDF assigns a clearly marked deterministic DÖF number',()=>{
  expect(demoDofNumber('RQ-2026-00127')).toBe('DÖF-DEMO-02600127');
  expect(demoDofNumber('')).toBe('DÖF-DEMO-00000001');
});

const entry=(path:string)=>(process.env.TEST_SITE_PREFIX||'')+(path==='/'?(process.env.TEST_SITE_PREFIX?'':'/'):path);

async function drawing(secondPage=true){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([700,550]);
  for(const [i,n] of [100,60,10,80,40,20,8].entries())page.drawText(`${i===2?'Ø':''}${n} ±0.10 mm`,{x:150,y:480-i*50,size:16,font});
  if(secondPage)pdf.addPage([700,550]).drawText('777 ±0.50 mm',{x:100,y:400,size:16,font});
  return Buffer.from(await pdf.save());
}

test('Turkish landing keeps demo on the same page and pricing works',async({page,isMobile})=>{
  await page.goto(entry('/'));await expect(page.getByRole('heading',{level:1})).toContainText('Bir çizimden fazlası');
  await expect(page.locator('html')).toHaveAttribute('lang','tr');
  await expect(page.getByRole('link',{name:'Kendi teknik resmimle başla'})).toHaveAttribute('href',entry('/demo'));
  await page.getByRole('link',{name:'İlk ölçümümü yap',exact:true}).click();await expect(page).toHaveURL(/#demo-workbench$/);
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:30000});
  if(isMobile)await page.getByRole('button',{name:'Menüyü aç'}).click();
  await page.getByRole('navigation',{name:'Ana menü'}).getByRole('link',{name:'Fiyatlandırma'}).click();
  await expect(page).toHaveURL(/\/pricing$/,{timeout:20000});
  await expect(page.getByRole('heading',{name:'Başlangıç',exact:true})).toBeVisible();

  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('uploaded PDF first page, five measurements, simulated remainder and inline signup',async({page})=>{
  test.setTimeout(60000);
  const aiCalls:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/demo-analysis'))aiCalls.push(r.url());});
  await page.goto(entry('/demo'));await page.getByLabel('PDF teknik resim seç').setInputFiles({name:'iki-sayfa.pdf',mimeType:'application/pdf',buffer:await drawing()});
  await expect(page.getByRole('img',{name:'Yüklenen PDF’nin ilk sayfası'})).toBeVisible({timeout:20000});
  await page.getByLabel('Parça adı',{exact:true}).fill('Bağlantı plakası');await page.getByLabel('Müşteri',{exact:true}).fill('Örnek Müşteri A.Ş.');
  await page.getByLabel('Lot / seri no',{exact:true}).fill('LOT-42');
  await expect(page.getByText('Sayfa 1 / 2 · Diğer sayfalar işlenmedi · 7 kontrol noktası')).toBeVisible();
  await expect(page.locator('.dd-plan-row')).toHaveCount(7);await expect(page.locator('.dd-plan')).not.toContainText('777');
  await expect(page.locator('.dd-plan-row').nth(5)).toBeDisabled();
  const beforePin=await page.locator('.dd-pin').first().boundingBox();
  await page.getByRole('button',{name:'Yakınlaştır',exact:true}).click();await expect(page.locator('.dd-stage')).not.toHaveCSS('transform','none');
  await expect.poll(async()=>Math.abs((await page.locator('.dd-pin').first().boundingBox())!.width-beforePin!.width)).toBeLessThan(1);
  await page.getByRole('button',{name:'İşaretleri gizle'}).click();await expect(page.locator('.dd-pin')).toHaveCount(0);await expect(page.locator('.dd-leaders')).toHaveCount(0);
  await page.getByRole('button',{name:'İşaretleri göster'}).click();await expect(page.locator('.dd-pin')).toHaveCount(7);
  await page.getByRole('button',{name:'Tüm çizimi göster'}).click();await expect(page.locator('.dd-stage')).toHaveCSS('transform','none');
  const input=page.getByLabel('Ölçülen değer',{exact:false});await expect(input).toHaveAttribute('inputmode','decimal');
  const formatGuide=page.locator('.dd-input-mask');await expect(formatGuide).toContainText('00,00');
  await input.fill('12,312');await expect(formatGuide).toBeVisible();await expect(formatGuide).toContainText('Biçim 00,00');await input.fill('');
  await expect(page.locator('.dd-verify')).toHaveCount(0);
  for(const [i,n] of ['100,02','60,20','10','80','40'].entries()){
    await input.fill(n);
    await expect(page.locator('.dd-status')).toContainText(i===1?'Uygunsuz':'Uygun');
    if(i===1)await page.getByLabel('Uygunsuzluk notu').fill('Çapak kontrol edilecek.');
    await page.getByRole('button',{name:'Ölçümü kaydet',exact:true}).click();
    if(i===0)await expect(page.getByText('İlk ölçümünüz kaydedildi!')).toBeVisible();
  }
  const report=page.getByRole('region',{name:'Ölçüm sonuç raporu'});await expect(report).toBeVisible();
  await expect(report).toContainText('PDF raporunuz hazır',{timeout:30000});
  await expect(report.locator('.rq-report-sheet')).toHaveCount(0);
  await expect(report).toContainText('en fazla 5');expect(aiCalls).toHaveLength(0);
  const pdfDownload=page.waitForEvent('download');await report.getByRole('link',{name:'PDF raporunu indir'}).click();
  const pdfFile=await pdfDownload;expect(pdfFile.suggestedFilename()).toBe('ritim-demo-olcum-raporu.pdf');
  const exported=await PDFDocument.load(await readFile((await pdfFile.path())!));
  expect(exported.getPageCount()).toBeGreaterThanOrEqual(2);expect(exported.getTitle()).toContain('Bağlantı plakası');
  expect(exported.getPages()[0].getWidth()).toBeCloseTo(595.28,1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV indir'}).click();const csv=await download;expect(csv.suggestedFilename()).toBe('ritim-demo-raporu.csv');expect(await readFile((await csv.path())!,'utf8')).toContain('Örnek Müşteri A.Ş.');

  await page.getByRole('button',{name:'Ücretsiz hesabımı oluştur'}).click();await expect(page.locator('.dd-signup')).toBeVisible();expect(new URL(page.url()).pathname).toBe(entry('/demo'));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('drag drop, invalid PDF and sample extraction',async({page})=>{
  test.setTimeout(90000);
  await page.goto(entry('/demo'));await page.getByLabel('PDF teknik resim seç').setInputFiles({name:'bozuk.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await expect(page.locator('.dd-error')).toContainText('geçerli bir PDF değil');
  const pdf=await PDFDocument.create();pdf.addPage();
  const data=await page.evaluateHandle(bytes=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(bytes)],'bos.pdf',{type:'application/pdf'}));return transfer;},Array.from(await pdf.save()));
  await page.locator('.dd-drop').dispatchEvent('drop',{dataTransfer:data});await data.dispose();await expect(page.getByRole('heading',{name:'Ölçüleri güvenle okuyamadık.'})).toBeVisible({timeout:60000});await expect(page.locator('.dd-plan-row')).toHaveCount(0);
  await page.getByRole('button',{name:'Örnek çizimle dene',exact:true}).click();await expect(page.locator('.dd-plan-row')).toHaveCount(7);await expect(page.getByRole('img',{name:'Yüklenen PDF’nin ilk sayfası'})).toBeVisible();
});

test('AI requires consent, sends only first-page data and preserves plan on failure',async({page})=>{
  let calls=0;
  await page.route('**/api/demo-analysis',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
    calls++;const body=route.request().postDataJSON();expect(body.image).toMatch(/^data:image\/jpeg;base64,/);expect(JSON.stringify(body.sources)).not.toContain('777');expect(route.request().headers()['x-ai-consent']).toBe('accepted');
    return route.fulfill({status:503,json:{error:'Analiz servisi geçici olarak kullanılamıyor.'}});
  });
  await page.goto(entry('/demo'));await page.getByLabel('PDF teknik resim seç').setInputFiles({name:'iki-sayfa.pdf',mimeType:'application/pdf',buffer:await drawing()});
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:20000});
  await expect(page.getByRole('button',{name:'İlk sayfayı analiz et'})).toBeDisabled();expect(calls).toBe(0);
  await page.getByLabel('İlk sayfa görüntüsünün ve metninin analiz için OpenAI’a gönderilmesine izin veriyorum.').check();await page.getByRole('button',{name:'İlk sayfayı analiz et'}).click();
  await expect(page.locator('.dd-error')).toContainText('geçici');await expect(page.locator('.dd-plan-row')).toHaveCount(7);expect(calls).toBe(1);
});

test('dimension parsing never invents tolerance or title block dimensions',()=>{
  const sources=(texts:string[]):SourceText[]=>texts.map((text,id)=>({id,text,x:10,y:10+id*10,width:12,height:2}));
  const points=extractDimensions(sources(['RQ-2026-100','2026','Scale 1:2','mm','Ø10','32 +0.02 / -0.01 mm','40 ±0,1','40 ±0,1']));
  expect(points).toHaveLength(4);expect(points[0].lower).toBeNull();expect(verdict(10,points[0])).toBe('unknown');
  expect(points[1].lower).toBe(31.99);expect(points[1].upper).toBe(32.02);expect(verdict(31.99,points[1])).toBe('pass');expect(verdict(32.021,points[1])).toBe('fail');
  expect(numeric('12,01')).toBe(12.01);expect(numeric('12mm')).toBeNull();
  expect(extractDimensions(sources(['10 ±0.1 mm','Ø20']))[1].unit).toBe('');
  expect(extractDimensions(sources(['Birim: mm','Ø20']))[0].unit).toBe('mm');
});

test('report header extraction uses explicit labels and leaves unknown customer empty',()=>{
  const source=(text:string,x:number,y:number):SourceText=>({id:0,text,x,y,width:10,height:1});
  const info=initialReportMetadata([source('TITLE',50,80),source('Montaj plakası',50,82),source('REV',80,80),source('B',80,82),source('LEGAL OWNER: Başka Firma',10,90)],new Date(2026,10,6));
  expect(info.partName).toBe('Montaj plakası');expect(info.revision).toBe('B');expect(info.customer).toBe('');expect(info.reportDate).toBe('2026-11-06');
  expect(initialReportMetadata([source('Müşteri: Örnek Müşteri',10,10)]).customer).toBe('Örnek Müşteri');
});

test('public routes and single application entry',async({page})=>{
  test.setTimeout(60000);
  for(const path of ['/signup','/login','/forgot-password','/privacy','/terms','/help']){
    await page.goto(entry(path));await expect(page.locator('main h1')).toBeVisible();
  }
  // The website redirects to the separate application; it does not own its server.
  const response=await page.request.get(entry('/app'),{maxRedirects:0});
  expect(response.status()).toBe(307);
  const target=new URL(response.headers().location);
  expect(target.origin).toBe(new URL(process.env.NEXT_PUBLIC_APPLICATION_URL||'http://localhost:3400').origin);
  expect(target.searchParams.get('view')).toBe('overview');
});

test('OCR candidates filter notes, low confidence and reversed digits',()=>{
  const source=(text:string,x:number,y:number,confidence=95):SourceText=>({id:0,text,x,y,width:2,height:2,confidence,origin:'ocr'});
  const points=extractDimensions([source('DIMENSIONS IN mm.',8,80),source('60',20,15),source('3x R3',10,18),source('40',20,20,45),source('2026',50,90),source('08',20,30)]);
  expect(points.map(p=>p.nominal)).toEqual([60,3]);expect(points.every(p=>p.source==='ocr'&&p.lower===null&&p.upper===null&&p.unit==='mm'&&!p.reviewed)).toBeTruthy();
  expect(originalBox({x0:30,y0:10,x1:40,y1:20},100,50,90)).toEqual({x:10,y:20,width:10,height:20});
  expect(originalBox({x0:10,y0:80,x1:20,y1:90},100,50,270)).toEqual({x:10,y:20,width:10,height:20});
});

test('drawing tolerances preserve explicit limits and use declared ISO class only',()=>{
  const s=(text:string,id:number):SourceText=>({id,text,x:20,y:20+id*3,width:3,height:2,origin:'ocr',confidence:95});
  const sources=['DIMENSIONS IN mm.','GENERAL TOLERANCES ISO 2768-m.','60','100 ±0.1','3x R3','30','120','HOLE CENTRE DISTANCES ±0.1'].map(s);
  const points=extractDimensions(sources);
  expect(points.map(p=>[p.nominal,p.lower,p.upper])).toEqual([[60,59.7,60.3],[100,99.9,100.1],[3,null,null],[30,29.8,30.2],[120,119.7,120.3]]);
  expect(drawingRules(sources).holeNote).toContain('±0.1');
  expect(isoTolerance(3,'m','edge')).toBe(.2);expect(isoTolerance(3,'m','linear')).toBe(.1);
  expect(isoTolerance(120.001,'m','linear')).toBe(.5);expect(isoTolerance(.49,'m','linear')).toBeNull();
  expect(extractDimensions([s('60',0)])[0].lower).toBeNull();
  expect(drawingRules([...sources,s('ISO 2768-f',10)]).isoClass).toBeNull();
  expect(drawingRules([{...s('ISO 2768-m',0),confidence:40}]).isoClass).toBeNull();
  const duplicate=extractDimensions([s('DIMENSIONS IN mm. ISO 2768-m',0),s('60',1),{...s('60 ±0.1',1),rotation:90}]);
  expect(duplicate).toHaveLength(1);expect([duplicate[0].lower,duplicate[0].upper]).toEqual([59.9,60.1]);
  const marker=placeMarkers([points[0]],[{...s('60',0),x:17,y:15,width:10,height:8}],1.4)[0]!;
  expect(marker.x+3<=16.5||marker.x-3>=27.5||marker.y+4.2<=14.5||marker.y-4.2>=23.5).toBeTruthy();
});

test('printed plus-minus detection rejects ordinary plus and equals signs',()=>{
  const pixels=(rows:string[])=>{const width=rows[0].length,data=new Uint8ClampedArray(width*rows.length*4).fill(255);rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#')for(let c=0;c<3;c++)data[(y*width+x)*4+c]=0;}));return plusMinusGlyph(data,width,rows.length);};
  expect(pixels(['   #   ','   #   ',' ##### ','   #   ','   #   ','       ',' ##### '])).not.toBeNull();
  expect(pixels(['   #   ','   #   ',' ##### ','   #   ','   #   ','       ','       '])).toBeNull();
  expect(pixels(['       ',' ##### ','       ','       ',' ##### ','       ','       '])).toBeNull();
});

test('metadata exclusions use labels and preserve real dimensions outside the title block',()=>{
  const s=(id:number,text:string,x:number,y:number):SourceText=>({id,text,x,y,width:5,height:1});
  const sources=[s(1,'REVISION NO',90,80),s(2,'R01',91,82),s(3,'MATERIAL',75,80),s(4,'DRAWN BY',55,83),s(5,'R5',15,85),s(6,'60 ±0.1',45,20),s(7,"Tüm ölçüler mm’dir.",5,30)];
  const points=extractDimensions(sources);expect(points.map(p=>p.nominal)).toEqual([5,60]);expect(points.every(p=>p.unit==='mm')).toBeTruthy();
  // Revision fields can be at the top, too; real R01 outside them is not banned.
  expect(extractDimensions([s(1,'REV.',10,3),s(2,'R01',11,5),s(3,'R01',50,30)]).map(p=>p.nominal)).toEqual([1]);
  expect(textBounds([0,-10,-10,0,60,70],30,100,100)).toEqual({x:50,y:40,width:10,height:30,rotation:-90});
  const candidate=(sourceId:number,nominal:number,x=0,y=0)=>({name:'Ölçü',original:'model taslağı',nominal,lower:nominal-.3,upper:nominal+.3,unit:'mm',sourceId,x,y});
  const checked=validateAnalyzedPoints([candidate(2,1),candidate(6,60),candidate(5,5)],sources);
  expect(checked.map(p=>p.nominal)).toEqual([60,5]);expect([checked[0].lower,checked[0].upper]).toEqual([59.9,60.1]);
  expect(validateAnalyzedPoints([candidate(6,600)],sources)).toHaveLength(0);
});

test('image-only PDF is read locally with OCR and only the first page is used',async({page})=>{
  test.setTimeout(90000);
  await page.goto(entry('/demo'));
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1600;const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='42px Arial';[120,60,30,20,10].forEach((n,i)=>ctx.fillText(String(n),500,200+i*170));ctx.fillText('DIMENSIONS IN mm.',180,1450);return c.toDataURL('image/png').split(',')[1];});
  const pdf=await PDFDocument.create(),png=await pdf.embedPng(Buffer.from(image,'base64'));pdf.addPage([900,600]).drawImage(png,{x:0,y:0,width:900,height:600});pdf.addPage().drawText('777 mm');
  const external:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://localhost:3500'))external.push(r.url());});
  await page.getByLabel('PDF teknik resim seç').setInputFiles({name:'goruntu.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await expect(page.locator('.dd-origin')).toContainText('Görüntüden okunan ölçü adayları',{timeout:60000});
  for(const n of [120,60,30,20,10])await expect(page.locator('.dd-plan-row').filter({hasText:`Uzunluk ${n}`})).toHaveCount(1);
  await expect(page.locator('.dd-plan')).not.toContainText('777');expect(external).toEqual([]);
  await expect(page.getByLabel('Alt sınırı düzenle')).toHaveValue('');
  await page.getByLabel('Alt sınırı düzenle').fill('119,9');await page.getByLabel('Üst sınırı düzenle').fill('120,1');await page.getByLabel('Üst sınırı düzenle').blur();
  await expect(page.locator('.dd-verify')).toHaveCount(0);await page.getByLabel('Ölçülen değer',{exact:false}).fill('120,02');
  await expect(page.getByRole('status')).toContainText('Uygun');await page.getByRole('button',{name:'Ölçümü kaydet'}).click();
  await expect(page.locator('.dd-measure-top')).toContainText('1 / 5');
});


test('processing deadline covers stalled initialization and cancellation',async()=>{
  const scope=processingScope(20,'deadline');
  await expect(scope.wait(new Promise(()=>{}))).rejects.toThrow('deadline');
  expect(scope.stopped).toBe(true);scope.close();
  const controller=new AbortController(),cancelled=processingScope(1000,'deadline',controller.signal);
  const result=cancelled.wait(new Promise(()=>{}));controller.abort(new Error('cancelled'));
  await expect(result).rejects.toThrow('cancelled');cancelled.close();
});

test('stalled PDF shows live status and cancellation allows another upload',async({page})=>{
  test.setTimeout(60000);
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/pdf.worker.min.mjs',async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto(entry('/demo'));
  const file={name:'bekleyen.pdf',mimeType:'application/pdf',buffer:await drawing(false)};
  await page.getByLabel('PDF teknik resim seç').setInputFiles(file);
  await expect(page.getByRole('heading',{name:'İlk sayfanız inceleniyor'})).toBeVisible();
  await expect(page.locator('.dd-processing [role=status]')).toContainText('PDF dosyası');
  await expect(page.locator('.dd-processing small')).not.toContainText(/^0 saniye/,{timeout:5000});
  await page.getByRole('button',{name:'İşlemi durdur',exact:true}).click();
  await expect(page.getByRole('button',{name:'PDF dosyası seç',exact:true})).toBeEnabled();
  release();await page.unroute('**/pdf.worker.min.mjs');
  await page.getByLabel('PDF teknik resim seç').setInputFiles({...file,name:'tekrar.pdf'});
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:20000});
  await expect(page.locator('.dd-processing')).toHaveCount(0);
});


test('demo accepts measurements without tolerance or approval and reports unknown',async({page})=>{
  test.setTimeout(60000);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([700,550]).drawText('Ø60 mm',{x:150,y:400,size:18,font});
  await page.goto(entry('/demo'));await page.getByLabel('PDF teknik resim seç').setInputFiles({name:'toleranssiz.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await expect(page.locator('.dd-plan-row')).toHaveCount(1,{timeout:20000});
  await page.getByLabel('Ölçülen değer',{exact:false}).fill('60');
  await page.getByRole('button',{name:'Ölçümü kaydet'}).click();
  await expect(page.locator('.dd-plan-row')).toContainText('Değerlendirilemedi');
  await expect(page.getByRole('link',{name:'PDF raporunu indir'})).toBeVisible({timeout:30000});
});


test('demo header fills blanks without replacing extracted or entered values',()=>{
  const original=initialReportMetadata([]);
  original.partName='Gerçek parça';original.customer='Kullanıcı firması';original.material='   ';
  const filled=withDemoMetadata(original);
  expect(filled.partName).toBe(original.partName);expect(filled.customer).toBe(original.customer);
  expect(filled.material).toBe('Alüminyum 6061 (Demo)');expect(filled.inspector).toContain('(Demo)');
  expect(Object.values(filled).every(v=>v.trim().length>0)).toBe(true);
  expect(filled.reportNumber).toBe(original.reportNumber);expect(filled.reportDate).toBe(original.reportDate);
  expect(original.material).toBe('   ');
});

test('premium report analysis separates real measurements and calculates tolerance violations',()=>{
  const point=(id:string,nominal:number,lower:number|null,upper:number|null)=>({id,name:`Ölçü ${id}`,original:String(nominal),nominal,lower,upper,unit:'mm',x:10,y:10,source:'text' as const,reviewed:true});
  const points=[point('one',100,99.9,100.1),point('two',10,9.98,10.02),point('three',60,59.9,60.1),point('four',20,19.95,20.05),point('five',40,39.95,40.05),point('example',8,7.9,8.1)];
  const doc={name:'report-test.pdf',pages:1,width:700,height:550,preview:'data:image/png;base64,',sources:[],points};
  const readings={one:{value:100,note:'',kind:'manual' as const},two:{value:12,note:'',kind:'manual' as const},three:{value:62,note:'',kind:'manual' as const},four:{value:21,note:'',kind:'manual' as const},five:{value:41,note:'',kind:'manual' as const},example:{value:8,note:'Gerçek ölçüm değildir.',kind:'simulated' as const}};
  const analysis=analyzeDemoReport(doc,readings);
  expect(analysis.status).toBe('nonconforming');
  expect(analysis.summary).toEqual({total:6,measured:5,passed:1,failed:4,unmeasured:0,examples:1});
  expect(analysis.failed.map(row=>row.outOfTolerance)).toEqual([1.98,1.9,.95,.95]);
  expect(measurementDeviation(points[0],99.9).outOfTolerance).toBe(0);
  expect(measurementDeviation(points[0],100.1).outOfTolerance).toBe(0);
  expect(measurementDeviation(points[0],99.89)).toEqual({deviation:-.11,outOfTolerance:.01,direction:'below'});
});

test('measurement parsing keeps decimal intent separate from locale display and stored numbers',()=>{
  const cases:[string,number][]=[['12,312',12.312],['12.312',12.312],['12312',12312],['10,005',10.005],['10.005',10.005]];
  for(const [raw,expected] of cases){
    expect(parseMeasurementInput(raw)).toEqual({value:expected,rawInput:raw,canonical:String(expected)});
    expect(numeric(raw)).toBe(expected);
  }
  expect(parseMeasurementInput('12.312,00')).toBeNull();
  expect(displayNumber(12312)).toBe('12312');
  expect(displayNumber(12.312)).toBe('12,312');

  const point={id:'five',name:'İç pencere genişliği',original:'40 ±0.05 mm',nominal:40,lower:39.95,upper:40.05,unit:'mm',x:10,y:10,source:'text' as const,reviewed:true};
  const doc={name:'stored-value.pdf',pages:1,width:700,height:550,preview:'data:image/png;base64,',sources:[],points:[point]};
  const decimal=analyzeDemoReport(doc,{five:{value:12.312,rawInput:'12.312',note:'',kind:'manual'}}).actual[0];
  expect(decimal).toMatchObject({deviation:-27.688,outOfTolerance:27.638,direction:'below'});
  expect(demoReportRowValues(decimal).slice(5,8)).toEqual(['12,312 mm','-27,688 mm','27,638 mm']);

  // A historical numeric value is preserved as stored; it is never guessed to mean 12.312.
  const historical=analyzeDemoReport(doc,{five:{value:12312,note:'',kind:'manual'}}).actual[0];
  expect(historical).toMatchObject({deviation:12272,outOfTolerance:12271.95,direction:'above'});
  expect(demoReportRowValues(historical).slice(5,8)).toEqual(['12312 mm','+12272 mm','12271,95 mm']);
});

test('premium demo PDF fixture is generated with accurate pagination',async({page,isMobile,browserName})=>{
  test.skip(isMobile||browserName!=='chromium','One desktop artifact is sufficient.');
  test.setTimeout(90000);
  await page.goto(entry('/demo'));
  await page.getByRole('button',{name:'Örnek çizimle deneyin'}).click();
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:30000});
  const input=page.getByLabel('Ölçülen değer',{exact:false});
  for(const [index,value] of ['100,02','10.005','60,15','20','39,90'].entries()){
    await input.fill(value);
    await page.getByRole('button',{name:'Ölçümü kaydet',exact:true}).click();
  }
  const download=page.waitForEvent('download');
  await page.getByRole('link',{name:'PDF raporunu indir'}).click();
  const file=await download,folder=resolve('test-results/report-v2'),path=resolve(folder,'premium-demo-report.pdf');
  await mkdir(folder,{recursive:true});await file.saveAs(path);
  const exported=await PDFDocument.load(await readFile(path));
  expect(exported.getPageCount()).toBeGreaterThanOrEqual(2);
  for(const sheet of exported.getPages()){expect(sheet.getWidth()).toBeCloseTo(595.28,1);expect(sheet.getHeight()).toBeCloseTo(841.89,1);}
});


test('premium product tabs and FAQ work on every viewport',async({page})=>{
  await page.goto(entry('/'));
  for(const name of ['Kontrol planı','Ölçüm istasyonu','Proses analizi','Ölçüm geçmişi']){
    const tab=page.getByRole('tab',{name:new RegExp(name)});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
    const image=page.getByRole('tabpanel').locator('img');await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  }
  await page.getByText('Demo hangi sınırlarla çalışıyor?',{exact:true}).click();await expect(page.getByText('En fazla 15 MB PDF yükleyebilirsiniz.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('mobile measurement focus mode keeps drawing, input and save action visible',async({page,isMobile})=>{
  test.skip(!isMobile,'Dedicated mobile composition.');
  test.setTimeout(60000);
  await page.goto(entry('/'));
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:30000});
  const input=page.getByLabel('Ölçülen değer',{exact:false});await input.focus();
  const focus=page.locator('.dd-measure.focus-mode');await expect(focus).toBeVisible();
  await expect(focus.locator('.dd-focus-preview')).toBeVisible();
  await expect(focus.locator('.dd-focus-leader line')).toHaveCount(1);
  await expect(focus.getByRole('heading',{name:'Plaka toplam genişliği'})).toBeVisible();
  await expect(focus.locator('.dd-limits')).toContainText('99,9');await expect(focus.locator('.dd-limits')).toContainText('100,1');
  const save=page.getByRole('button',{name:'Ölçümü kaydet'});await expect(save).toBeDisabled();await expect(input).toBeInViewport();await expect(save).toBeInViewport();
  await input.fill('100,02');await expect(save).toBeEnabled();
  await expect(focus.locator('.dd-input-label-result')).toContainText('Uygun');await expect(focus.locator('.dd-input-label-result')).toBeInViewport();
  const status=focus.locator('.dd-status');await expect(status).toContainText('Uygun');await expect(status).toBeInViewport();
  const boxes=await Promise.all([input.boundingBox(),save.boundingBox()]);expect(boxes[0]!.y+boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('mobile focus layout stays synchronized and non-overlapping across required viewport sizes',async({page,isMobile})=>{
  test.skip(isMobile,'One deterministic viewport matrix is sufficient.');
  test.setTimeout(90000);
  await page.setViewportSize({width:375,height:667});await page.goto(entry('/'));
  await expect(page.locator('.dd-plan-row')).toHaveCount(7,{timeout:30000});
  const input=page.getByLabel('Ölçülen değer',{exact:false});await input.focus();
  const save=page.getByRole('button',{name:'Ölçümü kaydet'}),focus=page.locator('.dd-measure.focus-mode');
  for(const size of [{width:390,height:500},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:360,height:800},{width:412,height:915}]){
    await page.setViewportSize(size);await expect(focus).toBeVisible();
    await input.fill('100,02');const status=focus.locator('.dd-status');await expect(status).toContainText('Uygun');
    const [inputBox,statusBox,saveBox]=await Promise.all([input.boundingBox(),status.boundingBox(),save.boundingBox()]);
    expect(inputBox!.y+inputBox!.height,`${size.width}x${size.height}: input/save overlap`).toBeLessThanOrEqual(saveBox!.y);
    expect(inputBox!.y).toBeGreaterThanOrEqual(0);expect(statusBox!.y+statusBox!.height).toBeLessThanOrEqual(size.height);expect(saveBox!.y+saveBox!.height).toBeLessThanOrEqual(size.height);
  }
  const expected=[['Plaka toplam genişliği','100,02'],['Sağ montaj deliği çapı','10,005'],['Plaka toplam yüksekliği','60,15'],['İç pencere yüksekliği','20'],['İç pencere genişliği','39,90']];
  for(const [index,[name,value]] of expected.entries()){
    await expect(focus.getByRole('heading',{name})).toBeVisible();await expect(page.locator('.dd-plan-row.selected')).toContainText(name);
    await expect(focus.locator('.dd-focus-preview span')).toHaveText(String(index+1));await input.fill(value);await save.click();
  }
  await expect(focus).toBeHidden();await expect(input).not.toBeFocused();await expect(page.locator('.dd-report')).toBeInViewport();
});


test('one application account and consistent plan limits',async({page})=>{
  await page.goto(entry('/signup'));await expect(page.getByRole('link',{name:'Ücretsiz hesap oluştur'})).toHaveAttribute('href',/auth=register/);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.goto(entry('/login'));await expect(page.getByRole('link',{name:'Uygulamaya giriş yap',exact:true})).toHaveAttribute('href',/auth=login/);
  await page.goto(entry('/pricing'));await expect(page.getByText('3 aktif kullanıcı',{exact:true})).toBeVisible();await expect(page.getByText('2.500 aylık numune kaydı',{exact:true})).toBeVisible();
});
