import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import type {
  PageObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';

// Initialize Notion client
const notion = new Client({
  auth: import.meta.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

// Database IDs from environment
const BLOG_DB_ID = import.meta.env.NOTION_BLOG_DB;
const IDEAS_DB_ID = import.meta.env.NOTION_IDEAS_DB;

// ── Types ──────────────────────────────────────────────────────────

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  date: string;
  description: string;
  tags: string[];
  author: string;
  coverImage: string | null;
}

export interface BlogPostWithContent extends BlogPost {
  content: string; // HTML content
}

export interface ValidatedIdea {
  id: string;
  name: string;
  industry: string;
  score: number;
  verdict: string;
  pitch: string;
  tam: string;
  mvpCost: string;
  breakEvenCustomers: string;
  status: string;
  dateGenerated: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function getRichText(property: { type: string; rich_text?: RichTextItemResponse[] }): string {
  if (property.type === 'rich_text' && property.rich_text) {
    return property.rich_text.map((t) => t.plain_text).join('');
  }
  return '';
}

function getTitle(property: { type: string; title?: RichTextItemResponse[] }): string {
  if (property.type === 'title' && property.title) {
    return property.title.map((t) => t.plain_text).join('');
  }
  return '';
}

function getCheckbox(property: { type: string; checkbox?: boolean }): boolean {
  if (property.type === 'checkbox') {
    return property.checkbox ?? false;
  }
  return false;
}

function getDate(property: { type: string; date?: { start: string } | null }): string {
  if (property.type === 'date' && property.date) {
    return property.date.start;
  }
  return new Date().toISOString().split('T')[0];
}

function getNumber(property: { type: string; number?: number | null }): number {
  if (property.type === 'number' && property.number !== null && property.number !== undefined) {
    return property.number;
  }
  return 0;
}

function getSelect(property: { type: string; select?: { name: string } | null }): string {
  if (property.type === 'select' && property.select) {
    return property.select.name;
  }
  return '';
}

function getMultiSelect(property: { type: string; multi_select?: { name: string }[] }): string[] {
  if (property.type === 'multi_select' && property.multi_select) {
    return property.multi_select.map((s) => s.name);
  }
  return [];
}

function getCoverImage(page: PageObjectResponse): string | null {
  // Check page cover
  if (page.cover) {
    if (page.cover.type === 'external') {
      return page.cover.external.url;
    }
    if (page.cover.type === 'file') {
      return page.cover.file.url;
    }
  }

  // Check Cover property (files type)
  const props = page.properties;
  const coverProp = props['Cover'];
  if (coverProp && coverProp.type === 'files' && coverProp.files.length > 0) {
    const file = coverProp.files[0];
    if (file.type === 'external') {
      return file.external.url;
    }
    if (file.type === 'file') {
      return file.file.url;
    }
  }

  return null;
}

// ── Mappers ────────────────────────────────────────────────────────

function pageToPost(page: PageObjectResponse): BlogPost {
  const props = page.properties;

  return {
    id: page.id,
    title: getTitle(props['Title'] as any),
    slug: getRichText(props['Slug'] as any) || page.id.replace(/-/g, ''),
    published: getCheckbox(props['Published'] as any),
    date: getDate(props['Date'] as any),
    description: getRichText(props['Description'] as any),
    tags: getMultiSelect(props['Tags'] as any),
    author: getRichText(props['Author'] as any) || 'IdeaBrief',
    coverImage: getCoverImage(page),
  };
}

function pageToIdea(page: PageObjectResponse): ValidatedIdea {
  const props = page.properties;

  return {
    id: page.id,
    name: getTitle(props['Idea Name'] as any),
    industry: getSelect(props['Industry'] as any),
    score: getNumber(props['Opportunity Score'] as any),
    verdict: getSelect(props['Verdict'] as any),
    pitch: getRichText(props['60-Second Pitch'] as any),
    tam: getRichText(props['TAM'] as any),
    mvpCost: getRichText(props['MVP Build Cost'] as any),
    breakEvenCustomers: getRichText(props['Break-Even Customers'] as any),
    status: getSelect(props['Status'] as any),
    dateGenerated: getDate(props['Date Generated'] as any),
  };
}

// ── Simple Markdown to HTML converter ──────────────────────────────

function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langAttr = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');

  // Unordered lists
  html = html.replace(/^[\t ]*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^[\t ]*\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (lines not already wrapped in HTML tags)
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Public API: Blog Posts ─────────────────────────────────────────

/**
 * Fetch all published blog posts (metadata only).
 * Returns posts sorted by date descending.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  if (!BLOG_DB_ID || !import.meta.env.NOTION_TOKEN) {
    console.warn('Notion blog credentials not configured. Returning empty blog posts.');
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: BLOG_DB_ID,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          property: 'Date',
          direction: 'descending',
        },
      ],
    });

    return response.results
      .filter((page): page is PageObjectResponse => 'properties' in page)
      .map(pageToPost);
  } catch (error) {
    console.error('Error fetching blog posts from Notion:', error);
    return [];
  }
}

/**
 * Fetch a single blog post by slug, including its content as HTML.
 */
export async function getPostBySlug(slug: string): Promise<BlogPostWithContent | null> {
  if (!BLOG_DB_ID || !import.meta.env.NOTION_TOKEN) {
    console.warn('Notion blog credentials not configured.');
    return null;
  }

  try {
    const response = await notion.databases.query({
      database_id: BLOG_DB_ID,
      filter: {
        and: [
          {
            property: 'Slug',
            rich_text: {
              equals: slug,
            },
          },
          {
            property: 'Published',
            checkbox: {
              equals: true,
            },
          },
        ],
      },
    });

    if (response.results.length === 0) {
      return null;
    }

    const page = response.results[0] as PageObjectResponse;
    const post = pageToPost(page);

    // Convert Notion blocks to markdown, then to HTML
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);
    const content = markdownToHtml(mdString.parent);

    return {
      ...post,
      content,
    };
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

/**
 * Get all published post slugs (for static path generation).
 */
export async function getAllPostSlugs(): Promise<string[]> {
  const posts = await getPublishedPosts();
  return posts.map((post) => post.slug);
}

// ── Public API: Validated Ideas ────────────────────────────────────

/**
 * Fetch validated ideas from the Daily SaaS Ideas database.
 * Returns ideas sorted by Opportunity Score descending.
 * Filters out ideas with "No-Go" verdict and "Passed" status.
 */
export async function getValidatedIdeas(): Promise<ValidatedIdea[]> {
  if (!IDEAS_DB_ID || !import.meta.env.NOTION_TOKEN) {
    console.warn('[IdeaBrief] Notion ideas credentials not configured.');
    console.warn('[IdeaBrief] IDEAS_DB_ID:', IDEAS_DB_ID ? 'SET' : 'MISSING');
    console.warn('[IdeaBrief] NOTION_TOKEN:', import.meta.env.NOTION_TOKEN ? 'SET' : 'MISSING');
    return [];
  }

  console.log('[IdeaBrief] Fetching ideas from Notion DB:', IDEAS_DB_ID);

  try {
    // First try a simple unfiltered query to verify access
    const response = await notion.databases.query({
      database_id: IDEAS_DB_ID,
      sorts: [
        {
          property: 'Opportunity Score',
          direction: 'descending',
        },
      ],
    });

    console.log('[IdeaBrief] Notion returned', response.results.length, 'raw results');

    const ideas = response.results
      .filter((page): page is PageObjectResponse => 'properties' in page)
      .map(pageToIdea)
      .filter((idea) => {
        // Exclude InvoiceScan
        if (idea.name === 'InvoiceScan') return false;
        // Exclude No-Go verdicts
        if (idea.verdict === 'No-Go') return false;
        // Exclude Passed status
        if (idea.status === 'Passed') return false;
        // Must have a score
        if (!idea.score || idea.score === 0) return false;
        // Must have a name
        if (!idea.name) return false;
        return true;
      });

    console.log('[IdeaBrief] After filtering:', ideas.length, 'ideas');
    if (ideas.length > 0) {
      console.log('[IdeaBrief] First idea:', ideas[0].name, '- Score:', ideas[0].score);
    }
    return ideas;
  } catch (error: any) {
    console.error('[IdeaBrief] Error fetching ideas from Notion.');
    console.error('[IdeaBrief] Error code:', error?.code);
    console.error('[IdeaBrief] Error message:', error?.message);
    console.error('[IdeaBrief] Error status:', error?.status);
    console.error('[IdeaBrief] Full error:', JSON.stringify(error, null, 2));
    return [];
  }
}

/**
 * Get the highest-scored idea for the featured sample card.
 */
export async function getFeaturedIdea(): Promise<ValidatedIdea | null> {
  const ideas = await getValidatedIdeas();
  return ideas.length > 0 ? ideas[0] : null;
}
