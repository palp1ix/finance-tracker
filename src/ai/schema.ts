import { z } from 'zod';

export const CurrencySchema = z.enum(['BYN', 'USD', 'EUR', 'RUB']);

export const AiResultSchema = z
  .object({
    index: z.number().int().nonnegative(),
    error: z.string().optional(),
    parsed: z
      .object({
        title: z.string().min(1),
        amount: z.coerce.number().nonnegative(),
        currency: CurrencySchema,
        categoryId: z.string().min(1),
        occurredAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date'),
        type: z.enum(['expense', 'refund']),
        note: z.string().optional(),
      })
      .optional(),
  })
  .refine((r) => (r.parsed ? !r.error : !!r.error), 'ровно одно: parsed или error');

export const AiBatchSchema = z.object({
  results: z.array(AiResultSchema),
});

export type AiResult = z.infer<typeof AiResultSchema>;
export type AiBatch = z.infer<typeof AiBatchSchema>;
