import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../lib/notion';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: 'IdeaBrief Blog',
    description: 'Insights and updates on AI-validated startup ideas, market analysis, and building in underserved industries.',
    site: context.site?.toString() || 'https://ideabrief.ai',
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.description,
      link: `/blog/${post.slug}/`,
      categories: post.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
