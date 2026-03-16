import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import type {
  PageObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';

// ── Config ──────────────────────────────────────────────────────────
// Env vars must be passed in from Astro pages/API routes where
// import.meta.env is resolved at runtime. Vite statically replaces
// import.meta.env and process.env during bundling, making them
// unavailable in library modules at runtime.

let _config: { token: string; ideasDb: string; blogDb: string } | null = null;
let _notion: Client | null = null;
let _n2m: NotionToMarkdown | null = null;

/**
 * Initialize the Notion config. Must be called once from an Astro page
 * or API route before using any other functions.
 */
export function initNotion(config: { token: string; ideasDb: string; blogDb: string }) {
  _config = config;
  // Reset clients so they pick up new config
  _notion = null;
  _n2m = null;
}

function getConfig() {
  if (!_config) {
    throw new Error('[IdeaBrief] Notion not initialized. Call initNotion() first.');
  }
  return _config;
}

function getNotionClient(): Client {
  if (!_notion) {
    _notion = new Client({ auth: getConfig().token });
  }
  return _notion;
}

function getN2M(): NotionToMarkdown {
  if (!_n2m) {
    _n2m = new NotionToMarkdown({ notionClient: getNotionClient() });
  }
  return _n2m;
}

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

// All helpers guard against undefined/null properties to prevent crashes
// when a Notion property doesn't exist or has an unexpected name.

function getRichText(property: any): string {
  if (!property || property.type !== 'rich_text' || !property.rich_text) return '';
  return property.rich_text.map((t: any) => t.plain_text).join('');
}

function getTitle(property: any): string {
  if (!property || property.type !== 'title' || !property.title) return '';
  return property.title.map((t: any) => t.plain_text).join('');
}

function getCheckbox(property: any): boolean {
  if (!property || property.type !== 'checkbox') return false;
  return property.checkbox ?? false;
}

function getDate(property: any): string {
  if (!property || property.type !== 'date' || !property.date) {
    return new Date().toISOString().split('T')[0];
  }
  return property.date.start;
}

function getNumber(property: any): number {
  if (!property || property.type !== 'number' || property.number === null || property.number === undefined) return 0;
  return property.number;
}

function getSelect(property: any): string {
  if (!property || property.type !== 'select' || !property.select) return '';
  return property.select.name;
}

function getMultiSelect(property: any): string[] {
  if (!property || property.type !== 'multi_select' || !property.multi_select) return [];
  return property.multi_select.map((s: any) => s.name);
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
    title: getTitle(props['Title']),
    slug: getRichText(props['Slug']) || page.id.replace(/-/g, ''),
    published: getCheckbox(props['Published']),
    date: getDate(props['Date']),
    description: getRichText(props['Description']),
    tags: getMultiSelect(props['Tags']),
    author: getRichText(props['Author']) || 'IdeaBrief',
    coverImage: getCoverImage(page),
  };
}

function pageToIdea(page: PageObjectResponse): ValidatedIdea {
  const props = page.properties;

  return {
    id: page.id,
    name: getTitle(props['Idea Name']),
    industry: getSelect(props['Industry']),
    score: getNumber(props['Opportunity Score']),
    verdict: getSelect(props['Verdict']),
    pitch: getRichText(props['60-Second Pitch']),
    tam: getRichText(props['TAM']),
    mvpCost: getRichText(props['MVP Build Cost']),
    breakEvenCustomers: getRichText(props['Break-Even Customers']),
    status: getSelect(props['Status']),
    dateGenerated: getDate(props['Date Generated']),
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
  const { blogDb: blogDbId, token } = getConfig();
  if (!blogDbId || !token) {
    console.warn('[IdeaBrief] Blog credentials not configured. DB:', blogDbId ? 'SET' : 'MISSING', 'Token:', token ? 'SET' : 'MISSING');
    return [];
  }

  try {
    const response = await getNotionClient().databases.query({
      database_id: blogDbId,
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
  const { blogDb: blogDbId, token } = getConfig();
  if (!blogDbId || !token) {
    console.warn('[IdeaBrief] Blog credentials not configured.');
    return null;
  }

  try {
    const response = await getNotionClient().databases.query({
      database_id: blogDbId,
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
    const mdBlocks = await getN2M().pageToMarkdown(page.id);
    const mdString = getN2M().toMarkdownString(mdBlocks);
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
  const { ideasDb: ideasDbId, token } = getConfig();
  if (!ideasDbId || !token) {
    console.warn('[IdeaBrief] Ideas credentials not configured');
    return [];
  }

  try {
    const response = await getNotionClient().databases.query({
      database_id: ideasDbId,
      sorts: [
        {
          property: 'Opportunity Score',
          direction: 'descending',
        },
      ],
    });

    return response.results
      .filter((page): page is PageObjectResponse => 'properties' in page)
      .map(pageToIdea)
      .filter((idea) => {
        if (idea.name.toLowerCase().includes('invoicescan')) return false;
        if (idea.verdict === 'No-Go') return false;
        if (idea.status === 'Passed') return false;
        if (!idea.score || idea.score === 0) return false;
        if (!idea.name) return false;
        return true;
      });
  } catch (error: any) {
    console.error('[IdeaBrief] Error fetching ideas:', error?.message);
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
