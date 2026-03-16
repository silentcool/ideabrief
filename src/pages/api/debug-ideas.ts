import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

export const GET: APIRoute = async () => {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Check env vars via import.meta.env
  const metaToken = import.meta.env.NOTION_TOKEN || '';
  const metaDb = import.meta.env.NOTION_IDEAS_DB || '';
  
  // Test 2: Check env vars via process.env
  const procToken = process.env.NOTION_TOKEN || '';
  const procDb = process.env.NOTION_IDEAS_DB || '';
  
  diagnostics.env = {
    meta_token: metaToken ? `SET(${metaToken.substring(0, 8)}...)` : 'MISSING',
    meta_db: metaDb || 'MISSING',
    proc_token: procToken ? `SET(${procToken.substring(0, 8)}...)` : 'MISSING',
    proc_db: procDb || 'MISSING',
    fallback_token: (metaToken || procToken) ? 'OK' : 'BOTH_MISSING',
    fallback_db: (metaDb || procDb) ? 'OK' : 'BOTH_MISSING',
  };

  const token = metaToken || procToken;
  const dbId = metaDb || procDb;

  if (!token || !dbId) {
    diagnostics.tests.skip = 'Missing credentials';
    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Test 3: Direct query (no sort, no filter) — baseline
  try {
    const client = new Client({ auth: token });
    const resp = await client.databases.query({
      database_id: dbId,
      page_size: 5,
    });
    diagnostics.tests.bare_query = {
      status: 'OK',
      count: resp.results.length,
      has_more: resp.has_more,
      first_page_props: resp.results.length > 0 
        ? Object.keys((resp.results[0] as any).properties || {})
        : [],
    };
  } catch (e: any) {
    diagnostics.tests.bare_query = { status: 'ERROR', code: e?.code, message: e?.message };
  }

  // Test 4: Query with sort (matching notion.ts)
  try {
    const client = new Client({ auth: token });
    const resp = await client.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Opportunity Score', direction: 'descending' }],
    });
    diagnostics.tests.sorted_query = {
      status: 'OK',
      count: resp.results.length,
    };
    
    // Map first 3 results the same way notion.ts does
    const mapped = resp.results.slice(0, 3).map((page: any) => {
      const props = page.properties;
      return {
        name: props['Idea Name']?.title?.map((t: any) => t.plain_text).join('') || '(empty)',
        score: props['Opportunity Score']?.number ?? '(null)',
        verdict: props['Verdict']?.select?.name || '(empty)',
        industry: props['Industry']?.select?.name || '(empty)',
        status: props['Status']?.select?.name || '(empty)',
        pitch_len: (props['60-Second Pitch']?.rich_text?.map((t: any) => t.plain_text).join('') || '').length,
      };
    });
    diagnostics.tests.sorted_mapped = mapped;
    
    // Apply the same filters as notion.ts
    const filtered = resp.results
      .filter((p: any) => 'properties' in p)
      .map((page: any) => {
        const props = page.properties;
        const name = props['Idea Name']?.title?.map((t: any) => t.plain_text).join('') || '';
        const score = props['Opportunity Score']?.number || 0;
        const verdict = props['Verdict']?.select?.name || '';
        const status = props['Status']?.select?.name || '';
        return { name, score, verdict, status };
      });
    
    diagnostics.tests.pre_filter = filtered.map(f => ({
      name: f.name,
      score: f.score,
      verdict: f.verdict,
      status: f.status,
      would_pass: f.name !== '' && f.name !== 'InvoiceScan' && f.verdict !== 'No-Go' && f.status !== 'Passed' && f.score > 0,
    }));
    
    const afterFilter = filtered.filter(f => 
      f.name && f.name !== 'InvoiceScan' && f.verdict !== 'No-Go' && f.status !== 'Passed' && f.score > 0
    );
    diagnostics.tests.after_filter_count = afterFilter.length;
  } catch (e: any) {
    diagnostics.tests.sorted_query = { status: 'ERROR', code: e?.code, message: e?.message };
  }

  // Test 5: Call getValidatedIdeas from notion.ts
  try {
    const { getValidatedIdeas } = await import('../../lib/notion');
    const ideas = await getValidatedIdeas();
    diagnostics.tests.notion_ts_call = {
      status: 'OK',
      count: ideas.length,
      first: ideas.length > 0 ? { name: ideas[0].name, score: ideas[0].score } : null,
    };
  } catch (e: any) {
    diagnostics.tests.notion_ts_call = { status: 'ERROR', code: e?.code, message: e?.message, stack: e?.stack?.split('\n').slice(0, 3) };
  }

  return new Response(JSON.stringify(diagnostics, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
