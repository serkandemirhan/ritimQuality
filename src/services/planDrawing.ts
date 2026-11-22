import type {Characteristic,ControlPlan,Product,ProductImage} from '../types';

/** Resolve the same image and per-image pin coordinates used by the plan editor. */
export function planDrawing(plan:ControlPlan,product:Product,characteristicId?:string,imageId?:string){
 const images=editorDrawingImages(plan,product);
 if(plan.characteristicImageLinks===undefined){
  return {source:plan.drawingImageUrl||product.defaultDrawingUrl||images[0]?.url||'',characteristics:plan.characteristics,images:[] as ProductImage[],missing:false};
 }
 const links=plan.characteristicImageLinks;
 const active=links.filter(link=>link.characteristicId===(characteristicId||plan.characteristics[0]?.id));
 const references=active.map(link=>images.find(image=>image.id===link.imageId)).filter((image):image is ProductImage=>!!image);
 const image=references.find(image=>image.id===imageId)||references[0];
 if(!image)return {source:'',characteristics:[] as Characteristic[],images:references,missing:active.length>0};
 const characteristics=plan.characteristics.flatMap(c=>{
  const link=links.find(link=>link.characteristicId===c.id&&link.imageId===image.id);
  const pin=link?.annotations.find(annotation=>annotation.type==='pin');
  return pin?.type==='pin'?[{...c,pin:{x:pin.x,y:pin.y}}]:[];
 });
 return {source:image.url,characteristics,images:references,missing:false};
}

/** Legacy plans can have a plan-specific drawing different from the product default. */
export function editorDrawingImages(plan:ControlPlan,product:Product):ProductImage[]{
 const images:ProductImage[]=product.images?.length?[...product.images]:product.defaultDrawingUrl?[{id:'legacy-drawing',name:'Teknik resim',url:product.defaultDrawingUrl}]:[];
 const references=plan.characteristicImageLinks;
 if(plan.drawingImageUrl&&(references===undefined&&!images.some(image=>image.url===plan.drawingImageUrl)||references?.some(link=>link.imageId==='plan-drawing')&&!images.some(image=>image.id==='plan-drawing')))
  images.unshift({id:'plan-drawing',name:'Plan teknik resmi',url:plan.drawingImageUrl});
 if(references?.some(link=>link.imageId==='legacy-drawing')&&!images.some(image=>image.id==='legacy-drawing')&&(plan.drawingImageUrl||product.defaultDrawingUrl))
  images.push({id:'legacy-drawing',name:'Teknik resim',url:plan.drawingImageUrl||product.defaultDrawingUrl!});
 return images;
}
