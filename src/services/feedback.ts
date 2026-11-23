export type FeedbackRequest={message:string;confirm:boolean;resolve:(value:boolean)=>void};
export const feedbackQueue:FeedbackRequest[]=[];
const announce=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('rq-feedback'));};
export const confirmAction=(message:string)=>new Promise<boolean>(resolve=>{feedbackQueue.push({message,confirm:true,resolve});announce();});
export const notify=(message:unknown)=>{feedbackQueue.push({message:String(message),confirm:false,resolve:()=>{}});announce();};
