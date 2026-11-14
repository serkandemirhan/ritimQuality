import { PDFDocument } from 'pdf-lib';
import { MEDIA_MIME_TYPES } from './mediaStorage.js';

/** Validate bytes before creating a ready local evidence record. */
export async function assertMediaContent(data: Buffer, mime: string, kind: string): Promise<void> {
  const invalid = () => Object.assign(new Error('Dosya içeriği belirtilen türle eşleşmiyor veya dosya bozuk.'), { status: 400 });
  const expectedKind = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : 'file';
  if (!(MEDIA_MIME_TYPES as readonly string[]).includes(mime) || kind !== expectedKind) throw invalid();
  const text = (start: number, end: number) => data.subarray(start, end).toString('ascii');
  let matches = false;
  switch (mime) {
    case 'image/png': matches = data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && text(12,16) === 'IHDR'; break;
    case 'image/jpeg': matches = data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 && data[data.length-2] === 255 && data[data.length-1] === 217; break;
    case 'image/gif': matches = data.length >= 14 && ['GIF87a','GIF89a'].includes(text(0,6)) && data.readUInt16LE(6) > 0 && data.readUInt16LE(8) > 0 && data[data.length-1] === 59; break;
    case 'image/webp': matches = data.length >= 20 && text(0,4) === 'RIFF' && text(8,12) === 'WEBP' && ['VP8 ','VP8L','VP8X'].includes(text(12,16)) && data.readUInt32LE(4) + 8 === data.length; break;
    case 'application/pdf': matches = text(0,5) === '%PDF-'; break;
    case 'video/mp4':
    case 'video/quicktime': matches = data.length >= 16 && text(4,8) === 'ftyp' && data.readUInt32BE(0) >= 16 && data.readUInt32BE(0) <= data.length; break;
    case 'video/webm': matches = data.length >= 12 && data.subarray(0,4).equals(Buffer.from([26,69,223,163])) && data.subarray(0,4096).includes(Buffer.from('webm')); break;
  }
  if (!matches) throw invalid();
  if (mime === 'image/png' && (!data.readUInt32BE(16) || !data.readUInt32BE(20) || data.readUInt32BE(16) * data.readUInt32BE(20) > 50_000_000)) throw invalid();
  try {
    if (mime === 'application/pdf') {
      const pdf = await PDFDocument.load(data);
      if (!pdf.getPageCount()) throw invalid();
    } else if (mime === 'image/png' || mime === 'image/jpeg') {
      const pdf = await PDFDocument.create();
      const image = mime === 'image/png' ? await pdf.embedPng(data) : await pdf.embedJpg(data);
      if (!image.width || !image.height || image.width * image.height > 50_000_000) throw invalid();
    }
  } catch { throw invalid(); }
}
