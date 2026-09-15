import {readFile,appendFile} from 'node:fs/promises';
import webpush from 'web-push';

const file=process.argv[2]||'.env.cloud';
const source=await readFile(file,'utf8');
const defined=new Set(source.split(/\r?\n/).map(line=>line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean));
if(defined.has('VAPID_PUBLIC_KEY')&&defined.has('VAPID_PRIVATE_KEY')&&defined.has('VAPID_SUBJECT')){
  console.log('VAPID configuration already exists; no changes made.');
  process.exit(0);
}
const keys=webpush.generateVAPIDKeys();
const additions=[];
if(!defined.has('VAPID_PUBLIC_KEY'))additions.push(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
if(!defined.has('VAPID_PRIVATE_KEY'))additions.push(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
if(!defined.has('VAPID_SUBJECT'))additions.push('VAPID_SUBJECT=mailto:admin@example.com');
await appendFile(file,`\n# Web Push bildirimleri\n${additions.join('\n')}\n`,'utf8');
console.log(`VAPID configuration added to ${file}. Copy the three VAPID variables to the deployment environment.`);
