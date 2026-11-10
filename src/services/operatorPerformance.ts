import type {InspectionLog} from '../types';

export interface OperatorDailyPerformance {
  operatorId:string;
  operatorName:string;
  controls:number;
  timedControls:number;
  averageActiveSeconds:number|null;
  totalActiveSeconds:number;
  failedControls:number;
  retryCount:number;
  offlineControls:number;
  points:number;
}

const localDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function dailyOperatorPerformance(logs:InspectionLog[],day=new Date()):OperatorDailyPerformance[]{
  const wanted=localDay(day.toISOString());
  const rows=new Map<string,OperatorDailyPerformance>();
  for(const log of logs.filter(item=>localDay(item.timing?.completedAt||item.timestamp)===wanted)){
    const id=log.operatorUserId||log.operatorName;
    const row=rows.get(id)||{operatorId:id,operatorName:log.operatorName,controls:0,timedControls:0,averageActiveSeconds:null,totalActiveSeconds:0,failedControls:0,retryCount:0,offlineControls:0,points:0};
    row.controls++;row.points+=log.totalPointsChecked||0;if(log.overallStatus==='fail')row.failedControls++;
    if(log.timing){row.timedControls++;row.totalActiveSeconds+=Math.max(0,log.timing.activeSeconds);if((log.timing.offlineSeconds||0)>0)row.offlineControls++;}
    const attempts=(log.mobileMeasurement as {attempts?:{previousAttemptId?:string}[]}|undefined)?.attempts||[];
    row.retryCount+=attempts.filter(attempt=>attempt.previousAttemptId).length;
    rows.set(id,row);
  }
  return [...rows.values()].map(row=>({...row,averageActiveSeconds:row.timedControls?Math.round(row.totalActiveSeconds/row.timedControls):null})).sort((a,b)=>b.controls-a.controls||a.operatorName.localeCompare(b.operatorName,'tr'));
}

export const durationLabel=(seconds:number|null)=>seconds===null?'Henüz ölçülmüyor':seconds<60?`${seconds} sn`:`${Math.floor(seconds/60)} dk ${seconds%60} sn`;
