/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { defaultFeeds } from './defaultFeeds';

describe('defaultFeeds', () => {
  it('contains the expected security feeds', () => {
    expect(defaultFeeds.length).toBeGreaterThan(0);
    const names = defaultFeeds.map((f) => f.name);
    expect(names).toContain('The Hacker News');
    expect(names).toContain('BleepingComputer');
    expect(names).toContain('JPCERT/CC');
    expect(names).toContain('CISA Advisories');
    expect(names).toContain('Krebs on Security');
  });

  it('has valid URLs and categories', () => {
    for (const feed of defaultFeeds) {
      expect(feed.url).toMatch(/^https?:\/\//);
      expect(feed.category).toBeTruthy();
      expect(feed.enabled).toBe(true);
    }
  });
});
