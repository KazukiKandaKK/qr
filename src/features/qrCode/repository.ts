import type { PrismaClient } from '@prisma/client';
import { QrCode, CreateQrCodeInput } from './domain';

export interface QrCodeRepository {
  findMany(): Promise<QrCode[]>;
  findById(id: string): Promise<QrCode | null>;
  create(data: CreateQrCodeInput): Promise<QrCode>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryQrCodeRepository implements QrCodeRepository {
  private records = new Map<string, QrCode>();
  private idSeq = 0;

  async findMany(): Promise<QrCode[]> {
    return Array.from(this.records.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findById(id: string): Promise<QrCode | null> {
    return this.records.get(id) ?? null;
  }

  async create(data: CreateQrCodeInput): Promise<QrCode> {
    this.idSeq += 1;
    const record: QrCode = {
      id: `qr-${this.idSeq}`,
      title: data.title,
      content: data.content,
      createdAt: new Date(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

export class PrismaQrCodeRepository implements QrCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(): Promise<QrCode[]> {
    const rows = await this.prisma.qrCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<QrCode | null> {
    const row = await this.prisma.qrCode.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateQrCodeInput): Promise<QrCode> {
    const row = await this.prisma.qrCode.create({ data });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.qrCode.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(row: {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }): QrCode {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
    };
  }
}
