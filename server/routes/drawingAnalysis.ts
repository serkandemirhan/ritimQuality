import { Router, raw } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { analyzeDrawing } from '../services/drawingAnalysis.js';
import {consumeLimit} from '../services/requestLimit.js';
const router=Router();
const active=new Set<string>();
router.post('/drawing-analysis',requireAuth,requireRole('admin','quality_engineer'),raw({type:'application/pdf',limit:'4mb'}),async(req,res)=>{
  if(req.headers['x-ai-consent']!=='accepted'){res.status(400).json({error:'Dış yapay zekâ işleme izni gerekli.'});return;}
  if(!Buffer.isBuffer(req.body)){res.status(400).json({error:'PDF dosyası gönderilmedi.'});return;}
  const scope=req.auth!.tenantId+':'+req.auth!.userId;
  try {
    if(!await consumeLimit('drawing-analysis',req.auth!.tenantId,30,3600)){res.status(429).json({error:'Saatlik analiz sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.'});return;}
  }catch{res.status(503).json({error:'Analiz hizmetine şu anda ulaşılamıyor.'});return;}
  if(active.has(scope)){res.status(429).json({error:'Devam eden analizin tamamlanmasını bekleyin.'});return;}
  active.add(scope);
  try{res.json(await analyzeDrawing(req.body));}
  catch(error){res.status(422).json({error:error instanceof Error&&error.name==='TimeoutError'?'Analiz zaman aşımına uğradı. Tekrar deneyin.':error instanceof Error&&error.name==='ZodError'?'Yapay zekâ yanıtı doğrulanamadı. Tekrar deneyin.':error instanceof Error?error.message:'PDF analizi tamamlanamadı.'});}
  finally{active.delete(scope);}
});
export {router as drawingAnalysisRouter};
