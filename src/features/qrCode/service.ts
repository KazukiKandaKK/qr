import type { Logger } from 'pino';
import { QrCode, CreateQrCodeInput } from './domain';
import { createQrCodeSchema } from './schemas';
import { QrCodeRepository } from './repository';

export class QrCodeService {
  constructor(
    private readonly repository: QrCodeRepository,
    private readonly logger: Logger,
  ) {}

  list(): Promise<QrCode[]> {
    this.logger.debug('listing qr codes');
    return this.repository.findMany();
  }

  getById(id: string): Promise<QrCode | null> {
    this.logger.debug({ id }, 'fetching qr code');
    return this.repository.findById(id);
  }

  async create(input: CreateQrCodeInput): Promise<QrCode> {
    const validated = createQrCodeSchema.parse(input);
    this.logger.info({ title: validated.title }, 'creating qr code');
    return this.repository.create(validated);
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info({ id }, 'deleting qr code');
    return this.repository.delete(id);
  }
}
