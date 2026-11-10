// Attach only the already-open application tab, leaving unrelated phone tabs out of the test.
module.exports=async function connect(chromium){
 const tabs=await(await fetch('http://127.0.0.1:9223/json/list')).json();
 const app=tabs.find(t=>t.url.startsWith('https://quality.getritim.com'));
 if(!app)throw Error('Telefonda açık Ritim sekmesi bulunamadı.');
 const ws=new WebSocket('ws://127.0.0.1:9223/devtools/browser');const queue=[];let internal=100000;
 const transport={send(m){if(ws.readyState===1)ws.send(JSON.stringify(m));else queue.push(m);},close(){ws.close();}};
 ws.onopen=()=>{for(const m of queue)ws.send(JSON.stringify(m));};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id>=100000)return;
  if(m.method==='Target.attachedToTarget'&&m.params.targetInfo.type==='page'&&m.params.targetInfo.targetId!==app.id){
   ws.send(JSON.stringify({id:internal++,method:'Runtime.runIfWaitingForDebugger',sessionId:m.params.sessionId}));
   ws.send(JSON.stringify({id:internal++,method:'Target.detachFromTarget',params:{sessionId:m.params.sessionId}}));return;
  }
  transport.onmessage?.(m);
 };
 ws.onclose=()=>transport.onclose?.();
 try{return await chromium.connectOverCDP(transport,{timeout:45000,noDefaults:true});}catch(e){ws.close();throw e;}
};
