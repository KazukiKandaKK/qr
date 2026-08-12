import http from 'node:http';

export function startLocalRssServer(
  items: string,
): Promise<{ server: http.Server; port: number }> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Local Test Feed</title>
    <link>https://example.com</link>
    <description>Test</description>
    ${items}
  </channel>
</rss>`;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(xml);
  });
  return new Promise((resolve) => {
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}
