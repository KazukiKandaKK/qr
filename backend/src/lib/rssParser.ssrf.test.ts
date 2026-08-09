/// <reference types="vitest/globals" />
import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import { parseFeed } from './rssParser';

function startServer(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <link>https://example.com</link>
    <item><title>Item</title><link>https://example.com/1</link></item>
  </channel>
</rss>`);
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

describe('parseFeed SSRF protection', () => {
  let server: http.Server | undefined;

  afterEach(
    async () =>
      new Promise<void>((resolve, reject) => {
        vi.unstubAllEnvs();
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => (err ? reject(err) : resolve()));
        server = undefined;
      }),
  );

  it('allows localhost feeds in development/test', async () => {
    const started = await startServer();
    server = started.server;
    const articles = await parseFeed(
      `http://localhost:${started.port}/feed`,
    );
    expect(articles).toHaveLength(1);
  });

  it('rejects localhost feeds in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const started = await startServer();
    server = started.server;
    await expect(
      parseFeed(`http://localhost:${started.port}/feed`),
    ).rejects.toThrow('localhost is not allowed');
  });

  it('rejects non-http schemes', async () => {
    await expect(parseFeed('ftp://example.com/feed')).rejects.toThrow(
      'Only http and https URLs are supported',
    );
  });

  it('rejects URLs with embedded credentials', async () => {
    await expect(
      parseFeed('http://user:pass@example.com/feed'),
    ).rejects.toThrow('URL credentials are not allowed');
  });
});
