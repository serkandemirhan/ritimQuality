import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planDrawing,editorDrawingImages} from '../src/services/planDrawing';
import type {ControlPlan,Product} from '../src/types';
const product={images:[{id:'old',name:'Eski resim',url:'old.svg'},{id:'new',name:'Yeni resim',url:'new.svg'}],defaultDrawingUrl:'old.svg'} as Product;
const plan={drawingImageUrl:'old.svg',characteristics:[{id:'a',pointNo:1,pin:{x:10,y:10}},{id:'b',pointNo:2,pin:{x:20,y:20}}],characteristicImageLinks:[{id:'la',characteristicId:'a',imageId:'new',annotations:[{id:'pin-a',type:'pin',x:75,y:65}]},{id:'lb',characteristicId:'b',imageId:'old',annotations:[{id:'pin-b',type:'pin',x:25,y:35}]}]} as ControlPlan;
test('published drawing links override stale general drawing and carry per-image coordinates',()=>{
 const before=structuredClone(plan),drawing=planDrawing(plan,product,'a');assert.equal(drawing.source,'new.svg');assert.equal(drawing.characteristics.length,1);assert.deepEqual(drawing.characteristics[0].pin,{x:75,y:65});assert.equal(planDrawing(plan,product,'b').source,'old.svg');assert.deepEqual(plan,before);
 const revision=structuredClone(plan);assert.equal(planDrawing(revision,product,'a').source,'new.svg');assert.deepEqual(planDrawing(revision,product,'a').characteristics[0].pin,{x:75,y:65});
});
test('multiple references use their own pins and never leak coordinates from another image',()=>{
 const multiple={...plan,characteristicImageLinks:[...plan.characteristicImageLinks!,{id:'extra',characteristicId:'a',imageId:'old',annotations:[{id:'other-pin',type:'pin' as const,x:5,y:15}]}]};
 const drawing=planDrawing(multiple,product,'a','old');assert.equal(drawing.images.length,2);assert.equal(drawing.source,'old.svg');assert.deepEqual(drawing.characteristics.find(c=>c.id==='a')?.pin,{x:5,y:15});
});
test('dangling and deliberately removed bindings do not silently show old drawings',()=>{
 assert.equal(planDrawing(plan,{images:[]} as unknown as Product,'a').missing,true);
 assert.equal(planDrawing({...plan,characteristicImageLinks:[]},product,'a').source,'');
 const unpinned={...plan,characteristicImageLinks:[{...plan.characteristicImageLinks![0],annotations:[]}]};assert.deepEqual(planDrawing(unpinned,product,'a').characteristics,[]);
});
test('legacy editor and measurement preserve plan-specific image even when product default differs',()=>{
 const legacy={...plan,characteristicImageLinks:undefined,drawingImageUrl:'plan-only.pdf'};
 assert.equal(editorDrawingImages(legacy,product)[0].url,'plan-only.pdf');assert.equal(planDrawing(legacy,product).source,'plan-only.pdf');
 assert.equal(editorDrawingImages(plan,product).length,2);
 const persisted={...legacy,characteristicImageLinks:[{id:'persisted-link',imageId:'plan-drawing',characteristicId:'a',annotations:[{id:'pin',type:'pin' as const,x:60,y:40}]}]};
 assert.equal(planDrawing(persisted,product,'a').source,'plan-only.pdf');assert.equal(editorDrawingImages(persisted,product)[0].url,'plan-only.pdf');
});
