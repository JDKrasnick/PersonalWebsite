import { logoBottomOffset, textInkBottom } from '../lib/logo-alignment';

// Align painted artwork to painted type, rather than to image/line boxes.
const measure = document.createElement('canvas').getContext('2d');
const transparentBottom = new Map<string, number>();
const headers = [...document.querySelectorAll<HTMLElement>('.exp-header')];

function imagePadding(image: HTMLImageElement) {
  const cached = transparentBottom.get(image.currentSrc);
  if (cached !== undefined) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 0;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = canvas.height - 1; y >= 0; y--) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 0) {
        const padding = canvas.height - y - 1;
        transparentBottom.set(image.currentSrc, padding);
        return padding;
      }
    }
  }
  return 0;
}

function linkInkBottom(label: HTMLElement) {
  const node = label.firstChild;
  const content = node?.textContent?.trimEnd();
  if (!measure || !node || node.nodeType !== Node.TEXT_NODE || !content) return null;
  const range = document.createRange();
  const end = content.length;
  range.setStart(node, end - 1);
  range.setEnd(node, end);
  const lastCharacter = range.getBoundingClientRect();
  // Measure only the final rendered line if a company name wraps on mobile.
  let start = end - 1;
  while (start > 0) {
    range.setStart(node, start - 1);
    range.setEnd(node, start);
    if (Math.abs(range.getBoundingClientRect().top - lastCharacter.top) > 0.5) break;
    start--;
  }
  range.setStart(node, start);
  range.setEnd(node, end);
  const bounds = range.getBoundingClientRect();
  const style = getComputedStyle(label);
  measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  measure.textBaseline = 'alphabetic';
  const metrics = measure.measureText(content.slice(start));
  const values = [metrics.fontBoundingBoxAscent, metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxDescent];
  if (!values.every(Number.isFinite)) return null;
  return textInkBottom(bounds.top, bounds.height, metrics.fontBoundingBoxAscent, metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxDescent);
}

function align(header: HTMLElement) {
  const image = header.querySelector<HTMLImageElement>('.exp-logo img');
  const slot = header.querySelector<HTMLElement>('.exp-logo');
  const label = header.querySelector<HTMLElement>('.exp-company-label');
  if (!image?.complete || !image.naturalWidth || !slot || !label) return;
  const target = linkInkBottom(label);
  const imageBounds = image.getBoundingClientRect();
  if (target === null || !imageBounds.width || !imageBounds.height) return;
  try {
    const scale = Math.min(imageBounds.width / image.naturalWidth, imageBounds.height / image.naturalHeight);
    const bottom = logoBottomOffset(slot.getBoundingClientRect().bottom, target, imagePadding(image), scale);
    image.style.setProperty('--logo-bottom', `${bottom.toFixed(3)}px`);
  } catch {
    // A blocked image read leaves the CSS bottom alignment intact.
  }
}

let pending = 0;
function schedule() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    headers.forEach(align);
  });
}

const resize = new ResizeObserver(schedule);
headers.forEach(header => {
  resize.observe(header);
  header.querySelector('img')?.addEventListener('load', schedule);
});
void document.fonts.ready.then(schedule);
document.fonts.addEventListener('loadingdone', schedule);
schedule();
