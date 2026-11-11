/* Public, browser-local product demonstration. Never forwards API traffic. */
(()=>{
 'use strict';
 const P='ritim-public-quality-demo-v1:',rawGet=Storage.prototype.getItem,rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
 let tab=rawGet.call(sessionStorage,P+'tab');if(!tab){tab=crypto.randomUUID();rawSet.call(sessionStorage,P+'tab',tab);}
 const scope=P+tab+':';
 Storage.prototype.getItem=function(k){return rawGet.call(this,scope+k);};
 Storage.prototype.setItem=function(k,v){return rawSet.call(this,scope+k,String(v));};
 Storage.prototype.removeItem=function(k){return rawRemove.call(this,scope+k);};
 Storage.prototype.clear=function(){for(const k of Object.keys(this))if(k.startsWith(scope))rawRemove.call(this,k);};
 Storage.prototype.key=function(i){return Object.keys(this).filter(k=>k.startsWith(scope))[i]?.slice(scope.length)||null;};
 const open=indexedDB.open.bind(indexedDB),del=indexedDB.deleteDatabase.bind(indexedDB);
 indexedDB.open=(name,version)=>version===undefined?open(P+tab+':'+name):open(P+tab+':'+name,version);
 indexedDB.deleteDatabase=name=>del(P+tab+':'+name);
 try{Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>({}),getRegistration:async()=>undefined,addEventListener:()=>{},removeEventListener:()=>{}},configurable:true});}catch{}
 const password='RitimDemo2026!';
 function seed(){
  const now=new Date().toISOString(),id=crypto.randomUUID();
  const users=[['admin','Demo Yönetici','yonetici'],['operator','Demo Operatör','operator'],['quality_engineer','Demo Kalite Sorumlusu','kalite']].map(([role,name,email])=>({id:crypto.randomUUID(),role,name,email:email+'@demo.getritim.com',status:'active',department:role==='operator'?'Üretim':'Kalite',station_or_machine:'CNC-01'}));
  const drawing='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420"><rect width="800" height="420" fill="#eef4f1"/><g fill="#c5d6d0" stroke="#315b50" stroke-width="3"><path d="M85 170H220V120H550V170H715V250H550V300H220V250H85Z"/><path d="M220 170V250M550 170V250"/></g><g font-family="sans-serif" fill="#163c31" font-size="22"><text x="340" y="90">Ø 24,00 ± 0,02</text><text x="290" y="365">120,00 ± 0,05 mm</text><text x="580" y="140">Ra ≤ 1,60</text></g><g fill="#216b54" stroke="white" stroke-width="3"><circle cx="320" cy="200" r="20"/><circle cx="480" cy="230" r="20"/><circle cx="615" cy="205" r="20"/></g><g font-family="sans-serif" font-size="20" text-anchor="middle" fill="white"><text x="320" y="207">1</text><text x="480" y="237">2</text><text x="615" y="212">3</text></g></svg>');
  const product={id:'demo-product',code:'TM-024',name:'Tahrik mili',customer:'Örnek Otomotiv',material:'AISI 4140',category:'Talaşlı imalat',revision:'A',description:'Üç kontrol noktalı tanıtım parçası',defaultDrawingUrl:drawing,images:[],createdAt:now,updatedAt:now};
  const specs=[['diameter','Mil çapı',24,23.98,24.02,'mm','Dijital Kumpas 0.01'],['length','Toplam boy',120,119.95,120.05,'mm','Dijital Kumpas 0.01'],['surface','Yüzey pürüzlülüğü',1.2,0,1.6,'Ra','Diğer Ölçüm Aleti']];
  const plan={id:'demo-plan',productId:product.id,version:'v1.0',revisionDate:now.slice(0,10),revisionNote:'İlk demo kontrol planı',isActive:true,status:'active',author:users[0].name,approvedBy:users[2].name,requiresApproval:true,drawingImageUrl:drawing,defaultSampleCount:1,createdAt:now,updatedAt:now,characteristics:specs.map(([id,name,nominal,lsl,usl,unit,tool],i)=>({id,name,pointNo:i+1,type:'numeric',nominal,lsl,usl,tolUpper:usl-nominal,tolLower:lsl-nominal,precision:2,unit,tool,sampleSize:'1',frequency:'Parti başı',criticalClass:'major',evidencePolicy:'optional',pin:{x:[40,60,77][i],y:[48,55,49][i]}}))};
  const logs=Array.from({length:12},(_,i)=>{const values={diameter:24+(i%3-1)*.01,length:120+(i%3-1)*.02,surface:1.2+(i%3)*.1};return{id:crypto.randomUUID(),sessionCode:'DEMO-'+(100+i),controlNumber:'DEMO-'+(100+i),productId:product.id,productCode:product.code,productName:product.name,controlPlanId:plan.id,controlPlanVersion:plan.version,controlPlanSnapshot:plan,operatorUserId:users[1].id,operatorName:users[1].name,lotNumber:'DEMO-LOT-'+(i+1),orderNumber:'DEMO-IE-001',machineNo:'CNC-01',sampleCount:1,overallStatus:'pass',totalPointsChecked:3,failedPointsCount:0,warningPointsCount:0,timestamp:new Date(Date.now()-(i+1)*3600000).toISOString(),samples:[{sampleIndex:1,values,statuses:{diameter:'pass',length:'pass',surface:'pass'}}],approval:{status:'approved',reviewedBy:users[2].name,reviewedAt:now}};});
  return{company:{id,name:'Ritim Demo Fabrikası',legal_name:'Ritim Demo Fabrikası',industry:'Otomotiv',facility_location:'Bursa',plan_id:'enterprise',subscription_status:'active',unlimited_pilot:true,trial_ends_at:'2099-12-31T00:00:00Z'},users,products:[product],plans:[plan],logs,media:{},drafts:[],cases:[],tasks:[{id:crypto.randomUUID(),title:'Tahrik mili — ilk parça kontrolü',owner_id:users[1].id,product_id:product.id,due_at:new Date(Date.now()+86400000).toISOString(),priority:'high',created_at:now,request_context:{planId:plan.id,planVersion:plan.version,orderNumber:'DEMO-IE-001',lotNumber:'DEMO-LOT-YENI',sampleCount:1}}],notifications:[],audit:[],rules:{requireActivePlan:true,requireLotNumber:true,requireOrderNumber:true},counter:200};
 }
 function load(){try{const s=JSON.parse(rawGet.call(localStorage,P+'state'));if(s?.company&&s.users?.length)return s;}catch{}const s=seed();rawSet.call(localStorage,P+'state',JSON.stringify(s));return s;}
 function persist(s){rawSet.call(localStorage,P+'state',JSON.stringify(s));}
 function jwt(user,s){return btoa('{}')+'.'+btoa(JSON.stringify({userId:user.id,tenantId:s.company.id,role:user.role,exp:Math.floor(Date.now()/1000)+86400})).replace(/=/g,'')+'.public-demo';}
 const initialRole=new URLSearchParams(location.search).get('demoRole');
 if(['admin','operator','quality_engineer'].includes(initialRole)){const s=load();localStorage.setItem('qualitrack_access_token',jwt(s.users.find(u=>u.role===initialRole),s));}
 function actor(s){try{const token=localStorage.getItem('qualitrack_access_token');return s.users.find(u=>u.id===JSON.parse(atob(token.split('.')[1])).userId);}catch{return null;}}
 const nativeFetch=window.fetch.bind(window),response=(value,status=200)=>new Response(status===204?null:JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 function denied(){throw Object.assign(new Error('Bu demo rolünün bu işleme yetkisi yok.'),{status:403});}
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input),location.href);
  if(!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
  try{
   const s=load(),u=actor(s),route=url.pathname.slice(4),method=options.method||input.method||'GET';let b={};
   if(options.body)b=JSON.parse(options.body);else if(input instanceof Request&&method!=='GET')b=await input.clone().json();
   const allow=(...roles)=>{if(!u||!roles.includes(u.role))denied();};
   const event=(action,id)=>s.audit.unshift({id:Date.now(),action,entity_type:'demo',entity_id:id,actor_name:u?.name,created_at:new Date().toISOString(),after:b});
   if(route==='/auth/capabilities')return response({accountEmail:false});
   if(route==='/auth/login'){
    const user=s.users.find(x=>x.email.toLowerCase()===String(b.email).toLowerCase()&&x.status==='active');
    if(b.workspace!=='ritim-demo'||b.password!==password||!user)return response({error:'Demo çalışma alanı: ritim-demo. Aşağıdaki demo hesaplarını kullanın.'},401);
    return response({token:jwt(user,s),user});
   }
   if(route.startsWith('/auth/'))return response({error:'Tanıtım için yayınlanan demo hesaplarını kullanın. Hesap oluşturma ve e-posta işlemleri bu demoda kapalıdır.'},400);
   if(!u)return response({error:'Demo hesabıyla giriş yapın.'},401);
   if(route==='/bootstrap')return response({company:s.company,users:s.users,products:s.products,controlPlans:s.plans,inspectionLogs:s.logs.filter(l=>!l.voided),currentUserId:u.id,platformAdmin:false,usage:{control_plans:s.plans.length,users:s.users.length,monthly_measurements:s.logs.length}});
   if(route==='/inspection-rules'){if(method==='PUT'){allow('admin');s.rules=b;persist(s);}return response(s.rules);}
   if(route==='/push/config')return response({enabled:false,configured:false,publicKey:null});
   if(route.startsWith('/push/'))return response({},method==='DELETE'?204:200);
   if(route==='/work')return response({tasks:s.tasks.filter(t=>u.role!=='operator'||t.owner_id===u.id),cases:s.cases.filter(c=>u.role!=='operator'||c.owner_id===u.id),approvals:u.role==='operator'?[]:s.logs.filter(l=>!l.voided&&l.approval?.status==='pending').map(l=>({inspection_id:l.id,status:'pending',session_code:l.controlNumber,operator_name:l.operatorName})),notifications:s.notifications.filter(n=>n.user_id===u.id),summary:{open_cases:s.cases.filter(c=>c.state!=='closed').length,pending_approvals:s.logs.filter(l=>l.approval?.status==='pending').length,overdue_tasks:0}});
   if(route==='/audit-logs'){allow('admin');return response(s.audit);}
   if(route==='/organization'){
    allow('admin');if(method==='POST'){event('organization.created',Date.now());persist(s);}return response({plants:[{id:'demo-plant',name:'Bursa fabrikası'}],departments:[{id:'demo-dept',plant_id:'demo-plant',name:'Kalite'}],stations:[{id:'demo-station',department_id:'demo-dept',name:'CNC-01'}]});
   }
   if(route==='/media/config')return response({provider:'local',maxBytes:8*1024*1024});
   if(route==='/media'&&method==='POST'){allow('admin','operator','quality_engineer');const id=b.id||crypto.randomUUID();s.media[id]={...b,id,url:b.dataUrl,createdAt:new Date().toISOString()};persist(s);return response(s.media[id],201);}
   if(route.startsWith('/media/')){const media=s.media[route.split('/')[2]];if(!media)return response({error:'Demo dosyası bulunamadı.'},404);return nativeFetch(media.dataUrl);}
   if(route==='/company'&&method==='PATCH'){allow('admin');s.company={...s.company,...b};persist(s);return response(s.company);}
   if(route==='/users'&&method==='POST'){allow('admin');const old=s.users.find(x=>x.id===b.id);if(old)Object.assign(old,b);else s.users.push({...b,id:crypto.randomUUID()});event('user.saved',b.id);persist(s);return response(old||s.users.at(-1));}
   const entity=route.match(/^\/(products|control-plans|users)\/([^/]+)$/);
   if(entity){allow(...(entity[1]==='users'?['admin']:['admin','quality_engineer']));const list=entity[1]==='products'?s.products:entity[1]==='control-plans'?s.plans:s.users,index=list.findIndex(x=>x.id===entity[2]);if(method==='DELETE'){if(index>=0)list.splice(index,1);persist(s);return response(null,204);}if(method==='PUT'){if(entity[1]==='control-plans'&&b.isActive)for(const p of list)if(p.productId===b.productId){p.isActive=false;p.status='archived';}if(index>=0)list[index]=b;else list.push(b);event(entity[1]+'.saved',b.id);persist(s);return response(b);}}
   if(route==='/inspection-logs'&&method==='POST'){
    allow('admin','operator','quality_engineer');const existing=s.logs.find(l=>l.id===b.id);if(existing)return response(existing);
    const p=s.plans.find(p=>p.id===b.controlPlanId);if(!p)return response({error:'Kontrol planı seçin.'},409);
    let failed=0,checked=0;for(const sample of b.samples||[]){sample.statuses={};for(const c of p.characteristics){const value=sample.values?.[c.id];if(value==null||value==='')return response({error:c.name+': ölçüm eksik.'},409);const bad=(c.type||'numeric')==='numeric'?value<c.lsl||value>c.usl:value==='NOK';sample.statuses[c.id]=bad?'fail':'pass';checked++;if(bad)failed++;}}
    const historicalFailure=b.mobileMeasurement?.attempts?.some(a=>a.result==='fail');
    const log={...b,controlNumber:'DEMO-'+(++s.counter),controlPlanSnapshot:p,operatorUserId:u.id,operatorName:u.name,overallStatus:failed?'fail':'pass',failedPointsCount:failed,warningPointsCount:0,totalPointsChecked:checked,requiresReview:!!historicalFailure,approval:{status:'pending'}};delete log.clientSyncStatus;s.logs.unshift(log);
    if(failed||historicalFailure)s.cases.unshift({id:crypto.randomUUID(),inspection_id:log.id,title:'Ölçüm uygunsuzluğu: '+log.controlNumber,owner_id:s.users.find(x=>x.role==='quality_engineer').id,state:'open',severity:'major',due_at:new Date(Date.now()+86400000).toISOString(),version:1,containment:'',root_cause:'',action:'',verification:''});
    if(b.taskId){const task=s.tasks.find(t=>t.id===b.taskId);if(task){task.completed_at=new Date().toISOString();task.result_inspection_id=log.id;task.control_number=log.controlNumber;}}
    event('inspection.created',log.id);persist(s);return response(log,201);
   }
   const approval=route.match(/^\/approvals\/(.+)$/);if(approval){allow('admin','quality_engineer');const log=s.logs.find(l=>l.id===approval[1]);if(!log||log.approval?.status!=='pending')return response({error:'Kontrol onay beklemiyor.'},409);if(log.operatorUserId===u.id)return response({error:'Kendi kontrolünüze karar veremezsiniz.'},409);if(!b.reason?.trim()||b.reason.trim().length<5)return response({error:'En az 5 karakter gerekçe yazın.'},400);log.approval={status:b.status,reviewedBy:u.name,reviewedAt:new Date().toISOString(),reason:b.reason};if(b.status==='rejected')s.tasks.unshift({id:crypto.randomUUID(),title:'Yeniden kontrol: '+log.controlNumber,owner_id:log.operatorUserId,product_id:log.productId,due_at:new Date(Date.now()+86400000).toISOString(),priority:'high'});event('inspection.'+b.status,log.id);persist(s);return response(null,204);}
   const voided=route.match(/^\/inspection-logs\/(.+)\/void$/);if(voided){allow('admin','quality_engineer');const log=s.logs.find(l=>l.id===voided[1]);if(log)log.voided=true;persist(s);return response(null,204);}
   if(route==='/inspection-drafts')return response(s.drafts);
   const draft=route.match(/^\/inspection-drafts\/([^/]+)(?:\/(claim|release))?$/);if(draft){allow('admin','operator','quality_engineer');let row=s.drafts.find(d=>d.id===draft[1]);if(method==='PUT'){row={id:draft[1],payload:b,created_by:u.id,claimed_by:u.id,created_by_name:u.name,claimed_by_name:u.name,version:(row?.version||0)+1};s.drafts=s.drafts.filter(d=>d.id!==draft[1]);s.drafts.push(row);}else if(row){row.claimed_by=draft[2]==='release'?null:u.id;}persist(s);return response(row||{},draft[2]==='release'?204:200);}
   if(route==='/tasks'&&method==='POST'){allow('admin','quality_engineer');const task={id:crypto.randomUUID(),title:b.title,owner_id:b.ownerId,product_id:b.productId,due_at:b.dueAt,priority:b.priority||'normal',request_context:b.request?{...b.request,planVersion:s.plans.find(p=>p.id===b.request.planId)?.version}:null};s.tasks.unshift(task);event('task.created',task.id);persist(s);return response(task,201);}
   const task=route.match(/^\/tasks\/([^/]+)\/(start|complete)$/);if(task){const t=s.tasks.find(t=>t.id===task[1]);if(!t||u.role==='operator'&&t.owner_id!==u.id)denied();t[task[2]==='start'?'started_at':'completed_at']=new Date().toISOString();persist(s);return response(null,204);}
   const c=route.match(/^\/cases\/([^/]+)$/);if(c){allow('admin','quality_engineer');const item=s.cases.find(x=>x.id===c[1]);if(item)Object.assign(item,{owner_id:b.ownerId,due_at:b.dueAt,state:b.state,containment:b.containment,root_cause:b.rootCause,action:b.action,verification:b.verification,version:item.version+1});persist(s);return response(item||{});}
   if(route.startsWith('/notifications/'))return response(null,204);
   return response({error:'Bu işlem tanıtım alanına dahil değil. Ölçüm, plan ve onay akışını demo hesaplarıyla deneyebilirsiniz.'},400);
  }catch(e){return response({error:e.message||'Demo işlemi tamamlanamadı.'},e.status||400);}
 };
 addEventListener('DOMContentLoaded',()=>{
  // Data-URI drawings can finish loading before React's report-ready effect.
  // Replay readiness for the static demo's cached drawing after DOM commits.
  let drawingQueued=false;new MutationObserver(()=>{if(drawingQueued)return;drawingQueued=true;setTimeout(()=>{drawingQueued=false;for(const image of document.querySelectorAll('.rq-report-balloon-drawing img'))if(image.complete&&image.naturalWidth)image.dispatchEvent(new Event('load'));},60);}).observe(document.body,{childList:true,subtree:true});
  const banner=document.createElement('div');banner.id='public-demo-banner';banner.innerHTML='<strong>RİTİM KALİTE · TANITIM ORTAMI</strong><span>Örnek veriler bu tarayıcıda saklanır.</span><a href="../quality.html#role-demo">Hesaplar ve rehber</a><button type="button" id="demo-reset-data">Demoyu sıfırla</button>';
  const style=document.createElement('style');style.textContent='#public-demo-banner{font:12px system-ui;background:#173e33;color:white;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;position:relative;z-index:200}#public-demo-banner span{flex:1}#public-demo-banner a{color:#d4eedb;text-decoration:underline}#public-demo-banner button{padding:6px 10px;border:1px solid #9bc4b2;border-radius:6px;background:transparent;color:white}';document.head.appendChild(style);document.body.prepend(banner);
  document.getElementById('demo-reset-data').onclick=()=>{if(confirm('Yalnız bu tanıtımın örnek verileri başlangıca dönecek. Devam edilsin mi?')){const role=actor(load())?.role||'operator';persist(seed());location.href='index.html?demoRole='+role;}};
 });
})();
