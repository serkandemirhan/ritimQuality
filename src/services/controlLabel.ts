import type {InspectionLog} from '../types';
export const controlLabel=(log:Pick<InspectionLog,'controlNumber'|'sessionCode'>)=>log.controlNumber||(/^[a-z]+-[0-9a-f-]{30,}$/i.test(log.sessionCode)?'Numara atanıyor':log.sessionCode);
