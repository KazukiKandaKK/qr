/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import { QrCodeService } from './service';
import { InMemoryQrCodeRepository } from './repository';

describe('QrCodeService', () => {
  const logger = pino({ level: 'silent' });
  let repo: InMemoryQrCodeRepository;
  let service: QrCodeService;

  beforeEach(() => {
    repo = new InMemoryQrCodeRepository();
    service = new QrCodeService(repo, logger);
  });

  it('creates and lists a QR code', async () => {
    const created = await service.create({
      title: 'Example',
      content: 'https://example.com',
    });
    expect(created.title).toBe('Example');

    const list = await service.list();
    expect(list).toHaveLength(1);
  });

  it('rejects invalid input', async () => {
    await expect(
      service.create({ title: '', content: 'https://example.com' }),
    ).rejects.toThrow();
  });

  it('deletes a QR code', async () => {
    const created = await service.create({ title: 'Temp', content: 'C' });
    const deleted = await service.delete(created.id);
    expect(deleted).toBe(true);
    expect(await service.getById(created.id)).toBeNull();
  });
});
