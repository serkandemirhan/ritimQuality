import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function browserSession(name) {
  const output=resolve('output/desktop-revision',name);
  await mkdir(output,{recursive:true});
  const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',[
    '--headless=new','--remote-debugging-port=9359','--user-data-dir='+resolve('.runtime/remaining-revision-profile'),
    '--no-first-run','--disable-gpu','about:blank',
  ],{windowsHide:true,stdio:'ignore'});
  let socket;const errors=[],checks=[];
  const finish=async()=>{socket?.close();edge.kill();await writeFile(resolve(output,'checks.json'),JSON.stringify({checks,errors},null,2));};
  try {
    let target;
    for(let i=0;i<60;i++){try{target=(await(await fetch('http://127.0.0.1:9359/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(200);}
    if(!target)throw Error('Browser unavailable');
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
    let seq=0;const pending=new Map();
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
      if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(arg=>arg.value||arg.description).join(' '));
      if(message.id){const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(message.error):item.resolve(message.result);}
    });
    const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
    const assert=async(expression,label)=>{if(!await evaluate(expression))throw Error(label);checks.push(label);};
    const waitFor=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Not ready: '+expression);};
    const click=async(label,scope='main')=>{await evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(el=>el.textContent.trim()===${JSON.stringify(label)});if(!el)throw Error('Button missing: '+${JSON.stringify(label)});el.click();})()`);await delay(200);};
    const nav=async tab=>{await evaluate(`document.querySelector('#nav-tab-${tab}').click()`);await waitFor(`document.querySelector('#nav-tab-${tab}')?.getAttribute('aria-current')==='page'`);await delay(350);};
    const fill=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(100);};
    const key=async(key,code=key)=>{const windowsVirtualKeyCode={Escape:27,Enter:13,Tab:9,ArrowRight:39,ArrowLeft:37,Home:36,End:35}[key];await cmd('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});await delay(100);};
    const size=async(width,height=1000,mobile=false)=>{await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(200);};
    const shot=async(name)=>{const data=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(resolve(output,name+'.png'),Buffer.from(data.data,'base64'));};
    await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('qualitrack_access_token','review.eyJ0ZW5hbnRJZCI6InJldmlldyIsInVzZXJJZCI6InJldmlldy11c2VyIn0.preview');"});
    await size(1440);await fetch('http://127.0.0.1:3350/api/review/reset',{method:'POST'});
    await cmd('Page.navigate',{url:'http://127.0.0.1:3350'});await waitFor("!!document.querySelector('#nav-tab-overview')");await delay(700);
    return {cmd,evaluate,assert,waitFor,click,nav,fill,key,size,shot,checks,errors,finish};
  } catch(error) {errors.push(String(error));await finish();throw error;}
}
