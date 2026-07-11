// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.jdkrasnick.com',
  output: 'static',
  adapter: vercel(),
});
