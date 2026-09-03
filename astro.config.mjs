import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [tailwind()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'load',
  },
  experimental: {
    clientPrerender: true,
  },
});
