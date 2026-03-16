/**
 * Initialize Notion from Astro's runtime environment.
 * 
 * import.meta.env is only available in .astro files and API routes
 * at runtime (Vite replaces it at build time in regular .ts modules).
 * This file should be imported from .astro pages/API routes only.
 */
import { initNotion } from './notion';

export function ensureNotionInit() {
  initNotion({
    token: import.meta.env.NOTION_TOKEN || '',
    ideasDb: import.meta.env.NOTION_IDEAS_DB || '',
    blogDb: import.meta.env.NOTION_BLOG_DB || '',
  });
}
