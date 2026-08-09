/// <reference types="vitest/globals" />
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { parseFeed } from './rssParser';

function startRssServer(xml: string) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(xml);
  });
  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

const feedXml = (items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test</description>
    ${items}
  </channel>
</rss>`;

describe('parseFeed', () => {
  let server: http.Server;

  afterEach(
    async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('parses items from an RSS feed', async () => {
    const started = await startRssServer(
      feedXml(`
        <item>
          <title>First</title>
          <link>https://example.com/1</link>
          <pubDate>Mon, 01 Aug 2026 00:00:00 GMT</pubDate>
          <description>Hello world</description>
        </item>
      `),
    );
    server = started.server;

    const articles = await parseFeed(`http://localhost:${started.port}/feed`);
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('First');
    expect(articles[0].link).toBe('https://example.com/1');
    expect(articles[0].snippet).toBe('Hello world');
    expect(articles[0].publishedAt.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('uses description and truncates long snippets', async () => {
    const longContent = '<p>' + 'a'.repeat(250) + '</p>';
    const started = await startRssServer(
      feedXml(`
        <item>
          <title>Long</title>
          <link>https://example.com/2</link>
          <description>${longContent}</description>
        </item>
      `),
    );
    server = started.server;

    const articles = await parseFeed(`http://localhost:${started.port}/feed`);
    expect(articles).toHaveLength(1);
    expect(articles[0].snippet.length).toBe(201);
    expect(articles[0].snippet.endsWith('…')).toBe(true);
  });

  it('skips items without title or link', async () => {
    const started = await startRssServer(
      feedXml(`
        <item>
          <title>Valid</title>
          <link>https://example.com/1</link>
        </item>
        <item>
          <title>Missing link</title>
        </item>
        <item>
          <link>https://example.com/3</link>
        </item>
      `),
    );
    server = started.server;

    const articles = await parseFeed(`http://localhost:${started.port}/feed`);
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Valid');
  });

  it('limits items to 50 per feed', async () => {
    const items = Array.from({ length: 55 }, (_, i) => `
      <item>
        <title>Item ${i}</title>
        <link>https://example.com/${i}</link>
      </item>
    `).join('');
    const started = await startRssServer(feedXml(items));
    server = started.server;

    const articles = await parseFeed(`http://localhost:${started.port}/feed`);
    expect(articles).toHaveLength(50);
  });

  it('throws for a non-XML response', async () => {
    const started = await startRssServer('not xml');
    server = started.server;

    await expect(
      parseFeed(`http://localhost:${started.port}/feed`),
    ).rejects.toThrow();
  });
});
