import Parser from 'rss-parser';

export interface ParsedArticle {
  title: string;
  link: string;
  snippet: string;
  publishedAt: Date;
}

const MAX_ITEMS_PER_FEED = 50;
const MAX_SNIPPET_LENGTH = 200;

const parser = new Parser({ timeout: 30000 });

export function toSnippet(raw: string): string {
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= MAX_SNIPPET_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_SNIPPET_LENGTH)}…`;
}

export function toPublishedAt(
  isoDate: string | undefined,
  pubDate: string | undefined,
): Date {
  const dateString = isoDate || pubDate;
  if (dateString) {
    const parsed = new Date(dateString);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

export async function parseFeed(url: string): Promise<ParsedArticle[]> {
  const parsed = await parser.parseURL(url);
  const items: ParsedArticle[] = [];

  for (const item of parsed.items.slice(0, MAX_ITEMS_PER_FEED)) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) {
      continue;
    }

    const rawSnippet = item.contentSnippet || item.summary || '';
    items.push({
      title,
      link,
      snippet: toSnippet(rawSnippet),
      publishedAt: toPublishedAt(item.isoDate, item.pubDate),
    });
  }

  return items;
}
