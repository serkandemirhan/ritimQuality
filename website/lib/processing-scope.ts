/** A shared deadline covers initialization as well as every processing operation. */
export function processingScope(milliseconds:number,message:string,signal?:AbortSignal){
  let rejectStop:(reason:Error)=>void=()=>{};
  let stopped=false;
  const stop=new Promise<never>((_,reject)=>{rejectStop=reject;});
  void stop.catch(()=>{});
  const cancel=()=>{stopped=true;rejectStop(signal?.reason instanceof Error?signal.reason:new Error(message));};
  const timer=setTimeout(()=>{stopped=true;rejectStop(new Error(message));},milliseconds);
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  return {get stopped(){return stopped;},wait:<T>(work:Promise<T>)=>Promise.race([work,stop]),close:()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}};
}
