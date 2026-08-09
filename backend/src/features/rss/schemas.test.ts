/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import {
  createFeedSchema,
  updateFeedSchema,
  articleFilterSchema,
} from './schemas';

describe('createFeedSchema', () => {
  it('accepts a minimal valid feed', () => {
    const result = createFeedSchema.safeParse({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'News',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it('rejects an empty name', () => {
    const result = createFeedSchema.safeParse({
      name: '',
      url: 'https://example.com/feed',
      category: 'News',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid URL', () => {
    const result = createFeedSchema.safeParse({
      name: 'A',
      url: 'not-a-url',
      category: 'News',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 200 chars', () => {
    const result = createFeedSchema.safeParse({
      name: 'A'.repeat(201),
      url: 'https://example.com/feed',
      category: 'News',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a name exactly 200 chars', () => {
    const result = createFeedSchema.safeParse({
      name: 'A'.repeat(200),
      url: 'https://example.com/feed',
      category: 'News',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a category longer than 100 chars', () => {
    const result = createFeedSchema.safeParse({
      name: 'A',
      url: 'https://example.com/feed',
      category: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a URL longer than 2048 chars', () => {
    const result = createFeedSchema.safeParse({
      name: 'A',
      url: `https://example.com/${'a'.repeat(2040)}`,
      category: 'News',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a URL exactly 2048 chars', () => {
    const url = `https://example.com/${'a'.repeat(2028)}`;
    expect(url.length).toBe(2048);
    const result = createFeedSchema.safeParse({
      name: 'A',
      url,
      category: 'News',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateFeedSchema', () => {
  it('accepts partial update', () => {
    const result = updateFeedSchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('accepts empty update', () => {
    const result = updateFeedSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = updateFeedSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('articleFilterSchema', () => {
  it('accepts an empty filter', () => {
    const result = articleFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a full filter', () => {
    const result = articleFilterSchema.safeParse({
      feedId: 'feed-1',
      isRead: true,
      isStarred: false,
      keyword: 'security',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-boolean flags', () => {
    const result = articleFilterSchema.safeParse({ isRead: 'true' });
    expect(result.success).toBe(false);
  });
});
