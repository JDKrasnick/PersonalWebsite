import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });
const formats = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', avif: 'avif', heif: 'avif' };

// The URL and extension come from decoded image data, never a client-supplied path.
export async function saveBlogImage(buffer, filename, directory) {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw fail(413, 'Choose a picture under 10 MB.');
  let metadata;
  try {
    const image = sharp(buffer, { animated: true, limitInputPixels: 40_000_000, failOn: 'error' });
    metadata = await image.metadata();
    if (!formats[metadata.format] || (metadata.format === 'heif' && metadata.compression !== 'av1')) throw new Error('Unsupported format');
    await image.stats(); // Decode the pixels too: headers alone can describe a broken image.
  } catch {
    throw fail(400, 'Use a valid PNG, JPG, WebP, GIF, or AVIF picture, up to 40 megapixels.');
  }
  const stem = String(filename || 'picture').split(/[\\/]/).pop().replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'picture';
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  const name = `${stem}-${hash}.${formats[metadata.format]}`;
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `.${name}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, buffer, { flag: 'wx' });
    await rename(temporary, resolve(directory, name));
  } finally { await rm(temporary, { force: true }); }
  return { image: `/blog-images/uploads/${name}` };
}
