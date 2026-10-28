// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { blogDevPlugin } from './scripts/blog-dev.mjs';

export default defineConfig({
  site: 'https://www.jdkrasnick.com',
  output: 'static',
  adapter: vercel(),
  devToolbar: { enabled: false },
  integrations: [{
    name: 'private-local-editor',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/blog/editor', entrypoint: './src/dev/blog-editor.astro' });
      },
    },
  }],
  vite: { plugins: [blogDevPlugin()], server: { fs: { deny: ['**/.local/**', '**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**'] } } },
});
