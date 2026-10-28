// Shared by local authoring and the static Markdown importer.
export function postImage(image = '', imageAlt = '') {
  if (typeof image !== 'string' || image.length > 2000 || typeof imageAlt !== 'string' || imageAlt.length > 240) throw new Error('Use an image URL under 2,000 characters and alt text under 240 characters.');
  image = image.trim(); imageAlt = imageAlt.trim();
  if (image) {
    const local = /^\/(?!\/)[^\\\s]*$/.test(image) && !/[\u0000-\u001f]/.test(image);
    let remote = false;
    try { const url = new URL(image); remote = url.protocol === 'https:' && !url.username && !url.password; } catch { /* Root-relative image paths are also supported. */ }
    if (!local && !remote) throw new Error('Use an HTTPS image URL or a path starting with / from the public folder.');
  }
  return { image, imageAlt: image ? imageAlt : '' };
}
