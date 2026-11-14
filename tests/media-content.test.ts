import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {assertMediaContent} from '../server/services/mediaContent.ts';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHc8AAAAASUVORK5CYII=','base64');
test('accepts real PNG and PDF files',async()=>{
 await assertMediaContent(png,'image/png','photo');
 const doc=await PDFDocument.create();doc.addPage();await assertMediaContent(Buffer.from(await doc.save()),'application/pdf','file');
});
test('rejects declared PNG with non-image bytes, truncated image and incorrect MIME or kind',async()=>{
 for(const bytes of [Buffer.from('not an actual PNG image'),png.subarray(0,20),Buffer.concat([png.subarray(0,33),Buffer.from('corrupt')])])await assert.rejects(assertMediaContent(bytes,'image/png','photo'),{status:400});
 await assert.rejects(assertMediaContent(png,'image/jpeg','photo'),{status:400});
 await assert.rejects(assertMediaContent(png,'image/png','file'),{status:400});
 await assert.rejects(assertMediaContent(Buffer.from('<svg/>'),'image/svg+xml','photo'),{status:400});
 await assert.rejects(assertMediaContent(Buffer.from('%PDF-1.7 fake'),'application/pdf','file'),{status:400});
});
