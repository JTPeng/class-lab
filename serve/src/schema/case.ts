import { z } from 'zod';

export const CaseSummarySchema = z.object({
  summary: z.string(),
});
