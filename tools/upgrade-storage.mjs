import { readFileSync as read, writeFileSync as write } from 'node:fs';
import ts from 'typescript';
const mutations=['saveUser','deleteUser','saveCompany','saveProduct','deleteProduct','saveControlPlan','setActiveControlPlanVersion','deleteControlPlan','saveInspectionLog','deleteInspectionLog'];
for(const prefix of ['', 'on-premise/']){
  const api=prefix?'OnPremApi':'SaasApi';
  const path=prefix+'src/services/storage.ts';
  let s=read(path,'utf8').replace(/\r\n/g,'\n');
  for(const name of mutations){
    const start=s.indexOf('  '+name+':'); const end=s.indexOf('\n  },',start)+6;
    let block=s.slice(start,end);
    block=block.replace(': (',': async (').replace('): void =>','): Promise<void> =>');
    if(name==='saveInspectionLog') {
      block=block.replace('    const logs =',`    if (!${api}.hasSession()) throw new Error('Ölçümü kaydetmek için giriş yapın.');
    const confirmed = await ${api}.saveInspectionLog(log) as InspectionLog;
    log = confirmed;
    const logs =`);
      block=block.replace('logs.unshift(log);','const existingIndex = logs.findIndex(item => item.id === log.id);\n    if (existingIndex >= 0) logs[existingIndex] = log; else logs.unshift(log);');
    } else if(name==='setActiveControlPlanVersion') {
      const from=block.indexOf(`    if (${api}.hasSession()) updatedPlans.filter`);
      block=block.slice(0,from)+block.slice(block.indexOf('\n  },',from));
      block=block.replace('    localStorage.setItem',`    if (!${api}.hasSession()) throw new Error('Oturum açmanız gerekiyor.');
    await ${api}.saveControlPlan(updatedPlans.find(plan => plan.id === planId)!);
    localStorage.setItem`);
    } else {
      const match=block.match(new RegExp(`    if \\(${api}\\.hasSession\\(\\)\\) queueSync\\(\\(\\) => (.+)\\);`));
      if(!match) throw new Error(name);
      block=block.replace(match[0],'');
      const body=block.indexOf('=> {')+4;
      block=block.slice(0,body)+`\n    if (!${api}.hasSession()) throw new Error('Oturum açmanız gerekiyor.');\n    await ${match[1]};`+block.slice(body);
    }
    block=block.replace(new RegExp(`    if \\(${api}\\.hasSession\\(\\)\\) queueSync[^\\n]+\\n`,'g'),'');
    s=s.slice(0,start)+block+s.slice(end);
  }
  s=s.replace(/let syncQueue:[\s\S]*?\n};\n/, '');
  s=s.replace(" || plans[0]",'');
  write(path,s);

  // Make mutation handlers await server confirmation before updating UI or closing forms.
  const files=['App.tsx','components/OperatorStation.tsx','components/ControlPlanEditor.tsx','components/ProductManagement.tsx','components/MeasurementLogs.tsx'];
  for(const file of files){
    const path=prefix+'src/'+file;
    let content=read(path,'utf8').replace(/\r\n/g,'\n');
    const source=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const edits=[];
    const visit=node=>{
      if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text.startsWith('handle')&&node.initializer&&ts.isArrowFunction(node.initializer)&&ts.isBlock(node.initializer.body)){
        const fn=node.initializer; const body=fn.body;
        const calls=[];
        const find=n=>{
          if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.expression.getText(source)==='StorageService'&&mutations.includes(n.expression.name.text)) calls.push(n);
          ts.forEachChild(n,find);
        };find(body);
        if(calls.length){
          if(!fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))edits.push([fn.getStart(source),fn.getStart(source),'async ']);
          edits.push([body.getStart(source)+1,body.getStart(source)+1,'\n    try {']);
          edits.push([body.end-1,body.end-1,`\n    } catch (error) { StorageService.reportSyncError(error); alert(error instanceof Error ? error.message : 'İşlem kaydedilemedi.'); }\n  `]);
          calls.forEach(call=>edits.push([call.getStart(source),call.getStart(source),'await ']));
        }
      }
      ts.forEachChild(node,visit);
    };visit(source);
    edits.sort((a,b)=>b[0]-a[0]).forEach(([start,end,value])=>{content=content.slice(0,start)+value+content.slice(end)});
    write(path,content);
  }
}
