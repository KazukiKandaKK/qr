/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { toSnippet, toPublishedAt } from './rssParser';

describe('toSnippet', () => {
  it('strips html tags and normalizes whitespace', () => {
    const raw = '<p>Hello  <br/>world</p>';
    expect(toSnippet(raw)).toBe('Hello world');
  });

  it('returns short text unchanged', () => {
    const raw = 'Short text.';
    expect(toSnippet(raw)).toBe('Short text.');
  });

  it('truncates long text to 200 chars with ellipsis', () => {
    const raw = 'a'.repeat(250);
    const result = toSnippet(raw);
    expect(result.length).toBe(201);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles empty string', () => {
    expect(toSnippet('')).toBe('');
  });
});

describe('toPublishedAt', () => {
  it('parses an ISO date', () => {
    const date = toPublishedAt('2026-08-01T00:00:00Z', undefined);
    expect(date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('falls back to pubDate when isoDate is missing', () => {
    const date = toPublishedAt(undefined, '2026-08-02T00:00:00Z');
    expect(date.toISOString()).toBe('2026-08-02T00:00:00.000Z');
  });

  it('prefers isoDate over pubDate', () => {
    const date = toPublishedAt(
      '2026-08-01T00:00:00Z',
      '2026-08-02T00:00:00Z',
    );
    expect(date.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns now for invalid date string', () => {
    const before = Date.now();
    const date = toPublishedAt('not-a-date', 'also-invalid');
    const after = Date.now();
    expect(date.getTime()).toBeGreaterThanOrEqual(before);
    expect(date.getTime()).toBeLessThanOrEqual(after);
  });

  it('returns now when both dates are missing', () => {
    const before = Date.now();
    const date = toPublishedAt(undefined, undefined);
    const after = Date.now();
    expect(date.getTime()).toBeGreaterThanOrEqual(before);
    expect(date.getTime()).toBeLessThanOrEqual(after);
  });
});
