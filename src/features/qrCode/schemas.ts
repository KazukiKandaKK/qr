import { z } from 'zod';

export const createQrCodeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(4096),
});

export type CreateQrCodeInput = z.infer<typeof createQrCodeSchema>;
