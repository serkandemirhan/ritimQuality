import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSchema} from '../server/services/inspectionValidation.ts';
const point=(id:string,x:number,y:number)=>({id,pointNo:Number(id),name:'Ölçü',nominal:10,lsl:9,usl:11,pin:{x,y}});
const plan={id:'p',productId:'part',version:'v1.0',status:'active',isActive:true,drawingImageUrl:'drawing.png',characteristics:[point('1',20,30),point('2',50,60)]};
test('active drawings require distinct, finite, in-bounds balloons',()=>{
 assert.equal(planSchema.safeParse(plan).success,true);
 assert.equal(planSchema.safeParse({...plan,characteristics:[point('1',50,50),point('2',50,50)]}).success,false);
 assert.equal(planSchema.safeParse({...plan,characteristics:[point('1',120,50)]}).success,false);
 assert.equal(planSchema.safeParse({...plan,characteristics:[point('1',NaN,50)]}).success,false);
 assert.equal(planSchema.safeParse({...plan,status:'draft',isActive:false,characteristics:[point('1',50,50),point('2',50,50)]}).success,true);
});
