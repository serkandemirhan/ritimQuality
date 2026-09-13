import {readFileSync as read,writeFileSync as write} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
edit('src/components/OperatorStation.tsx',s=>s.replace("      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});\n      const kind: EvidenceAttachment['kind']=file.type.startsWith('image/')?'photo':file.type.startsWith('video/')?'video':'file';\n      const attachment=await SaasApi.uploadEvidence({fileName:file.name,mimeType:file.type||'application/octet-stream',kind,dataUrl});", "      const attachment=await SaasApi.uploadFile(file);"));
edit('src/components/ProductManagement.tsx',s=>{
  s="import { SaasApi } from '../services/api';\nimport { MediaImage } from './MediaImage';\n"+s;
  s=s.replace('const handleDrawingUpload = (event:', 'const handleDrawingUpload = async (event:');
  s=s.replace("    const reader=new FileReader(); reader.onload=()=>setDrawingUrl(String(reader.result||'')); reader.readAsDataURL(file);", "    try { const asset=await SaasApi.uploadFile(file);setDrawingUrl('media:'+asset.id+'#'+asset.mimeType); } catch(error){alert(error instanceof Error?error.message:'Dosya yüklenemedi.');}");
  return s.replaceAll('<img ', '<MediaImage ');
});
edit('src/components/ControlPlanEditor.tsx',s=>{
  s="import { SaasApi } from '../services/api';\n"+s;
  const from=s.indexOf('  const handleImageUpload =');const to=s.indexOf('  const toolOptions',from);
  return s.slice(0,from)+`  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];if(!file||!currentPlan)return;
    const planId=currentPlan.id;
    try {const asset=await SaasApi.uploadFile(file);setCurrentPlan(previous=>previous?.id===planId?{...previous,drawingImageUrl:'media:'+asset.id+'#'+asset.mimeType}:previous);}
    catch(error){alert(error instanceof Error?error.message:'Dosya yüklenemedi.');}
  };

`+s.slice(to);
});
edit('src/components/DrawingCanvas.tsx',s=>"import { useMediaSource, isPdfMedia } from './MediaImage';\n"+s.replace('  const containerRef =', '  const resolvedImageUrl = useMediaSource(imageUrl);\n  const containerRef =').replace("imageUrl.startsWith('data:application/pdf')", 'isPdfMedia(imageUrl)').replace('data={imageUrl}', 'data={resolvedImageUrl}').replace('src={imageUrl}', 'src={resolvedImageUrl||undefined}'));
edit('src/components/InspectionCertificateModal.tsx',s=>"import { MediaImage } from './MediaImage';\n"+s.replaceAll('<img ', '<MediaImage ').replace("{controlPlan.drawingImageUrl.startsWith('data:application/pdf')?<object data={controlPlan.drawingImageUrl} type=\"application/pdf\" className=\"h-48 w-full border border-slate-400 bg-white\" aria-label=\"PDF teknik resim\"/>:<MediaImage", '{false?null:<MediaImage'));
edit('server/routes/saas.ts',s=>s.replace("AND inspection_id IS NULL AND id=ANY($3::uuid[]) FOR UPDATE", "AND inspection_id IS NULL AND upload_status='ready' AND id=ANY($3::uuid[]) FOR UPDATE"));
edit('.gitignore',s=>s+'\ndist-server/\non-premise/dist-server/\n.data/\n.vercel/\n*.pem\n');
