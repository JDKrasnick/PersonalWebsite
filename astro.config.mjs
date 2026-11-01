// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { blogDevPlugin } from './scripts/blog-dev.mjs';

export default defineConfig({
  site: 'https://www.jdkrasnick.com',
  output: 'static',
  compressHTML: true,
  adapter: vercel(),
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [blogDevPlugin()],
    optimizeDeps: { include: ['ogl', 'vgpu'] },
    server: { fs: { deny: ['**/.local/**', '**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**'] } },
  },
});
