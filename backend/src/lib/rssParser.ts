import dns from 'node:dns/promises';
import Parser from 'rss-parser';
import ipaddr from 'ipaddr.js';

export interface ParsedArticle {
  title: string;
  link: string;
  snippet: string;
  publishedAt: Date;
}

const MAX_ITEMS_PER_FEED = 50;
const MAX_SNIPPET_LENGTH = 200;
const MAX_REDIRECTS = 3;
const FEED_TIMEOUT_MS = 30000;

const parser = new Parser({ timeout: FEED_TIMEOUT_MS });

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
  const xml = await fetchFeedXml(url);
  const parsed = (await parser.parseString(xml)) as Parser.Output<unknown>;
  const items: ParsedArticle[] = [];

  for (const item of parsed.items.slice(0, MAX_ITEMS_PER_FEED)) {
    const raw = item as {
      link?: string;
      title?: string;
      contentSnippet?: string;
      summary?: string;
      isoDate?: string;
      pubDate?: string;
    };
    const link = raw.link?.trim();
    const title = raw.title?.trim();
    if (!link || !title) {
      continue;
    }

    const rawSnippet = raw.contentSnippet || raw.summary || '';
    items.push({
      title,
      link,
      snippet: toSnippet(rawSnippet),
      publishedAt: toPublishedAt(raw.isoDate, raw.pubDate),
    });
  }

  return items;
}

async function fetchFeedXml(
  url: string,
  redirectCount = 0,
): Promise<string> {
  await assertAllowedUrl(url);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'rss-parser',
      Accept: 'application/rss+xml',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });

  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error('Too many redirects');
    }
    const nextUrl = new URL(
      res.headers.get('location')!,
      url,
    ).toString();
    return fetchFeedXml(nextUrl, redirectCount + 1);
  }

  if (!res.ok) {
    throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

async function assertAllowedUrl(urlString: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }

  if (url.username || url.password) {
    throw new Error('URL credentials are not allowed');
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost') {
    throw new Error('localhost is not allowed');
  }

  const ip = ipaddr.isValid(host) ? host : await resolveHost(host);
  if (!isPublicIp(ip)) {
    throw new Error('Private or internal IP addresses are not allowed');
  }
}

async function resolveHost(hostname: string): Promise<string> {
  try {
    const { address } = await dns.lookup(hostname);
    return address;
  } catch (err) {
    throw new Error(`Unable to resolve host: ${hostname}`);
  }
}

function isPublicIp(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    return addr.range() === 'unicast';
  } catch {
    return false;
  }
}
