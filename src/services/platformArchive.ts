import type { TenantArchive } from './platformApi';
export const toBase64 = (bytes: Uint8Array) => { const chunks: string[] = []; for (let i = 0; i < bytes.length; i += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768))); return btoa(chunks.join('')); };
export const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export const buffer = (value: Uint8Array) => value.slice().buffer as ArrayBuffer;
export async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(bytes)))).map(b => b.toString(16).padStart(2, '0')).join(''); }
interface Envelope {
    format: 'ritim-encrypted-backup';
    version: 1;
    cipher: 'AES-GCM';
    kdf: 'PBKDF2-SHA256';
    iterations: 210000;
    salt: string;
    iv: string;
    compression: 'gzip' | 'none';
    payload?: string;
}
async function key(passphrase: string, salt: Uint8Array) { const seed = await crypto.subtle.importKey('raw', buffer(new TextEncoder().encode(passphrase)), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: buffer(salt), iterations: 210000, hash: 'SHA-256' }, seed, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function streamBytes(stream: ReadableStream<Uint8Array>, max = 512 * 1024 * 1024) { const reader = stream.getReader(), chunks: Uint8Array[] = []; let length = 0; try {
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        length += value.length;
        if (length > max) {
            await reader.cancel();
            throw Error('Yedek bellek sınırını aşıyor.');
        }
        chunks.push(value);
    }
}
finally {
    reader.releaseLock();
} const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
} return bytes; }
export async function encryptTenantArchive(archive: TenantArchive, passphrase: string): Promise<Blob> {
    if (passphrase.length < 12)
        throw Error('Yedek parolası en az 12 karakter olmalı.');
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const header: Envelope = { format: 'ritim-encrypted-backup', version: 1, cipher: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: 210000, salt: toBase64(salt), iv: toBase64(iv), compression: typeof CompressionStream === 'function' ? 'gzip' : 'none' };
    const raw = new TextEncoder().encode(JSON.stringify(archive));
    const bytes = header.compression === 'gzip' ? await streamBytes(new Blob([buffer(raw)]).stream().pipeThrough(new CompressionStream('gzip'))) : raw;
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(new TextEncoder().encode(JSON.stringify(header))) }, await key(passphrase, salt), buffer(bytes));
    return new Blob([JSON.stringify({ ...header, payload: toBase64(new Uint8Array(encrypted)) })], { type: 'application/octet-stream' });
}
export async function decryptTenantArchive(file: File, passphrase: string): Promise<TenantArchive> {
    if (file.size > 256 * 1024 * 1024)
        throw Error('Yedek dosyası 256 MB sınırını aşıyor.');
    try {
        const data = JSON.parse(await file.text());
        if (data.format !== 'ritim-encrypted-backup' || data.version !== 1 || data.cipher !== 'AES-GCM' || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== 210000 || !['gzip', 'none'].includes(data.compression) || typeof data.payload !== 'string')
            throw Error('Geçersiz yedek.');
        const header: Envelope = { format: data.format, version: data.version, cipher: data.cipher, kdf: data.kdf, iterations: data.iterations, salt: data.salt, iv: data.iv, compression: data.compression };
        const salt = fromBase64(header.salt), iv = fromBase64(header.iv);
        if (salt.length !== 16 || iv.length !== 12)
            throw Error('Geçersiz anahtar.');
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(new TextEncoder().encode(JSON.stringify(header))) }, await key(passphrase, salt), buffer(fromBase64(data.payload)));
        const bytes = header.compression === 'gzip' ? await streamBytes(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))) : new Uint8Array(plain);
        const archive = JSON.parse(new TextDecoder().decode(bytes));
        if (archive.manifest?.format !== 'ritim-tenant' || archive.manifest?.version !== 1 || !archive.rows || !archive.media)
            throw Error('Yedek içeriği geçersiz.');
        return archive;
    }
    catch {
        throw Error('Yedek parolası yanlış veya dosya bozulmuş / desteklenmiyor.');
    }
}
