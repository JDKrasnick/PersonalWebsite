export function initBlogAppearance() {
  const root = document.documentElement;
  const theme = document.querySelector<HTMLSelectElement>('#blog-theme');
  const font = document.querySelector<HTMLSelectElement>('#blog-font');
  const menu = document.querySelector<HTMLDetailsElement>('.blog-appearance');
  if (!theme || !font || !menu) return;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const sync = () => {
    theme.value = root.dataset.blogThemePreference || 'system';
    font.value = root.dataset.blogFont || 'source';
  };
  const applyTheme = () => {
    root.dataset.blogTheme = root.dataset.blogThemePreference === 'system'
      ? (system.matches ? 'dark' : 'light') : root.dataset.blogThemePreference;
  };
  const save = () => {
    try { localStorage.setItem('blog-appearance', JSON.stringify({ theme: root.dataset.blogThemePreference, font: root.dataset.blogFont })); } catch {}
  };
  theme.addEventListener('change', () => { root.dataset.blogThemePreference = theme.value; applyTheme(); save(); });
  font.addEventListener('change', () => { root.dataset.blogFont = font.value; save(); });
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key !== 'blog-appearance' && event.key !== null) return;
    let settings: { theme?: string; font?: string } = {};
    try { settings = JSON.parse(event.newValue || '{}') || {}; } catch {}
    root.dataset.blogThemePreference = ['light', 'dark'].includes(settings.theme || '') ? settings.theme : 'system';
    root.dataset.blogFont = ['source', 'lato', 'plex', 'literata', 'inter'].includes(settings.font || '') ? settings.font : 'source';
    applyTheme(); sync();
  });
  document.addEventListener('click', event => { if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false; });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary')?.focus(); }
  });
  sync();
}
