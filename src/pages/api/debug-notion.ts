import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

export const GET: APIRoute = async () => {
  const token = import.meta.env.NOTION_TOKEN;
  const ideasDb = import.meta.env.NOTION_IDEAS_DB;
  const blogDb = import.meta.env.NOTION_BLOG_DB;

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NOTION_TOKEN: token ? `SET (${token.substring(0, 8)}...)` : 'MISSING',
      NOTION_IDEAS_DB: ideasDb || 'MISSING',
      NOTION_BLOG_DB: blogDb || 'MISSING',
    },
    ideas: null,
    blog: null,
  };

  if (!token) {
    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const notion = new Client({ auth: token });

  // Test Ideas DB
  try {
    const resp = await notion.databases.query({
      database_id: ideasDb,
      page_size: 3,
    });
    diagnostics.ideas = {
      status: 'OK',
      total_results: resp.results.length,
      has_more: resp.has_more,
      first_titles: resp.results.slice(0, 3).map((p: any) => {
        const titleProp = p.properties?.['Idea Name'];
        if (titleProp?.title) {
          return titleProp.title.map((t: any) => t.plain_text).join('');
        }
        return '(no title)';
      }),
    };
  } catch (error: any) {
    diagnostics.ideas = {
      status: 'ERROR',
      code: error?.code,
      message: error?.message,
      statusCode: error?.status,
    };
  }

  // Test Blog DB
  try {
    const resp = await notion.databases.query({
      database_id: blogDb,
      page_size: 3,
    });
    diagnostics.blog = {
      status: 'OK',
      total_results: resp.results.length,
      has_more: resp.has_more,
    };
  } catch (error: any) {
    diagnostics.blog = {
      status: 'ERROR',
      code: error?.code,
      message: error?.message,
      statusCode: error?.status,
    };
  }

  return new Response(JSON.stringify(diagnostics, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
