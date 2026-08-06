import { z } from 'zod';

export const createFeedSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2048),
  category: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
});

export const updateFeedSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

export const articleFilterSchema = z.object({
  feedId: z.string().optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  keyword: z.string().optional(),
});
