import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';
import { ensureNotionInit } from '../../lib/notion-init';

export const GET: APIRoute = async () => {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  const token = import.meta.env.NOTION_TOKEN || process.env.NOTION_TOKEN || '';
  const dbId = import.meta.env.NOTION_IDEAS_DB || process.env.NOTION_IDEAS_DB || '';

  if (!token || !dbId) {
    diagnostics.error = 'Missing credentials';
    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Test 1: Raw Notion API - get first page's full property structure
  const client = new Client({ auth: token });
  const resp = await client.databases.query({
    database_id: dbId,
    page_size: 1,
    sorts: [{ property: 'Opportunity Score', direction: 'descending' }],
  });

  if (resp.results.length > 0) {
    const page = resp.results[0] as any;
    const props = page.properties;
    
    // Show each property's type and value structure
    const propDetail: Record<string, any> = {};
    for (const [key, val] of Object.entries(props as Record<string, any>)) {
      propDetail[key] = {
        type: val.type,
        value_preview: JSON.stringify(val).substring(0, 200),
      };
    }
    diagnostics.first_page_properties = propDetail;
    diagnostics.first_page_id = page.id;
  }

  // Test 2: Call notion.ts getValidatedIdeas with extra logging
  try {
    // Reproduce exactly what notion.ts does but with diagnostics
    const resp2 = await client.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Opportunity Score', direction: 'descending' }],
    });
    
    diagnostics.raw_count = resp2.results.length;
    
    // Check 'properties' in page filter
    const withProps = resp2.results.filter((p: any) => 'properties' in p);
    diagnostics.with_properties_count = withProps.length;
    
    // Now check what pageToIdea equivalent gives us
    if (withProps.length > 0) {
      const page = withProps[0] as any;
      const props = page.properties;
      
      // Check each property access that pageToIdea uses
      diagnostics.property_access = {
        'Idea Name': {
          exists: 'Idea Name' in props,
          type: props['Idea Name']?.type,
          title_array: props['Idea Name']?.title?.length,
          value: props['Idea Name']?.title?.map((t: any) => t.plain_text).join(''),
        },
        'Opportunity Score': {
          exists: 'Opportunity Score' in props,
          type: props['Opportunity Score']?.type,
          number: props['Opportunity Score']?.number,
        },
        'Industry': {
          exists: 'Industry' in props,
          type: props['Industry']?.type,
          select: props['Industry']?.select?.name,
        },
        'Verdict': {
          exists: 'Verdict' in props,
          type: props['Verdict']?.type,
          select: props['Verdict']?.select?.name,
        },
        'Status': {
          exists: 'Status' in props,
          type: props['Status']?.type,
          select: props['Status']?.select?.name,
        },
        'Date Generated': {
          exists: 'Date Generated' in props,
          type: props['Date Generated']?.type,
          date: props['Date Generated']?.date,
        },
      };
    }
    
    // Now actually call the notion.ts function
    ensureNotionInit();
    const { getValidatedIdeas } = await import('../../lib/notion');
    const ideas = await getValidatedIdeas();
    diagnostics.notion_ts_result = {
      count: ideas.length,
      first_three: ideas.slice(0, 3).map(i => ({ name: i.name, score: i.score, verdict: i.verdict })),
    };
  } catch (e: any) {
    diagnostics.error = { code: e?.code, message: e?.message, stack: e?.stack?.split('\n').slice(0, 5) };
  }

  return new Response(JSON.stringify(diagnostics, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
