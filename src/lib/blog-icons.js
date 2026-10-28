export const BLOG_ICONS = [
  { value: 'document', label: 'Article', paths: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z', 'M14 3v6h6M8 13h8M8 17h5'] },
  { value: 'code', label: 'Code', paths: ['m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16'] },
  { value: 'research', label: 'Research', paths: ['M9 3h6M10 3v7L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-9V3', 'M7 15h10M10 17h.01M14 19h.01'] },
  { value: 'brain', label: 'AI', paths: ['M12 18V5m0 0a3 3 0 0 0-5-2 3 3 0 0 0-3 4 4 4 0 0 0-1 7 4 4 0 0 0 4 6 3 3 0 0 0 5-2m0-13a3 3 0 0 1 5-2 3 3 0 0 1 3 4 4 4 0 0 1 1 7 4 4 0 0 1-4 6 3 3 0 0 1-5-2', 'M7 7c0 2 2 2 2 4m8-4c0 2-2 2-2 4M5 14h3m11 0h-3'] },
  { value: 'terminal', label: 'Terminal', paths: ['M3 4h18v16H3Z', 'm7 8 4 4-4 4m7 0h3'] },
  { value: 'layers', label: 'Systems', paths: ['m12 3 10 5-10 5L2 8Z', 'm2 12 10 5 10-5M2 16l10 5 10-5'] },
];
export const defaultPostIcon = tags => {
  const text = (tags || []).join(' ').toLowerCase();
  return /research|experiment/.test(text) ? 'research' : /\bai\b|model|learning/.test(text) ? 'brain' : /code|engineer|software/.test(text) ? 'code' : 'document';
};
export function postIcon(value, size = 28) {
  const icon = BLOG_ICONS.find(icon => icon.value === value) || BLOG_ICONS[0];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.paths.map(path => `<path d="${path}"/>`).join('')}</svg>`;
}
