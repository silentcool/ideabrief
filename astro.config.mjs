import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://ideabrief.ai',
  output: 'server',
  adapter: vercel({
    isr: {
      expiration: 300, // Revalidate every 5 minutes
    },
  }),
  integrations: [sitemap()],
});
