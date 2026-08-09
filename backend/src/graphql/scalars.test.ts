/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { Kind } from 'graphql';
import { dateTimeScalar } from './scalars';

describe('dateTimeScalar', () => {
  it('serializes a Date to ISO string', () => {
    const date = new Date('2026-08-01T00:00:00Z');
    expect(dateTimeScalar.serialize(date)).toBe('2026-08-01T00:00:00.000Z');
  });

  it('serializes a string to ISO string', () => {
    expect(dateTimeScalar.serialize('2026-08-01T00:00:00Z')).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('serializes a number (timestamp) to ISO string', () => {
    const ts = new Date('2026-08-01T00:00:00Z').getTime();
    expect(dateTimeScalar.serialize(ts)).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns the value as-is for other types', () => {
    expect(dateTimeScalar.serialize(true as unknown as Date)).toBe(true);
  });

  it('parseValue converts a string to Date', () => {
    const parsed = dateTimeScalar.parseValue('2026-08-01T00:00:00Z');
    expect(parsed.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('parseValue converts a number to Date', () => {
    const ts = new Date('2026-08-01T00:00:00Z').getTime();
    const parsed = dateTimeScalar.parseValue(ts);
    expect(parsed.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('parseValue throws for non-string/number values', () => {
    expect(() => dateTimeScalar.parseValue(true)).toThrow(
      'DateTime parse error',
    );
  });

  it('parseLiteral converts a string literal to Date', () => {
    const ast = { kind: Kind.STRING, value: '2026-08-01T00:00:00Z' } as const;
    const parsed = dateTimeScalar.parseLiteral(ast);
    expect(parsed.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('parseLiteral throws for non-string literals', () => {
    const ast = { kind: Kind.INT, value: '123' } as const;
    expect(() => dateTimeScalar.parseLiteral(ast)).toThrow(
      'DateTime literal parse error',
    );
  });
});
