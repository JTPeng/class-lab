import { z } from 'zod';

// —— 生成输入(留档,便于复现 / 再生成) ——
export const LessonInputSchema = z.object({
  skill: z.string(),
  availableTools: z.array(z.string()),
  context: z.enum(['机构', '居家', '机构/居家']),
  reinforcerPref: z.string().optional(),
  sessionMinutes: z.number().optional(),
});
export type LessonInput = z.infer<typeof LessonInputSchema>;

// —— 阶段性目标 ——
export const PhaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  startDate: z.null(),
  passDate: z.null(),
});
export type Phase = z.infer<typeof PhaseSchema>;

// —— 短期目标 STO ——
export const StoSchema = z.object({
  teachingMaterials: z.string(),
  objectives: z.array(z.string()).min(2),
  strategy: z.string(),
  reinforcementPlan: z.string(),
  procedure: z.object({
    sd: z.string(),
    correct: z.object({
      response: z.string(),
      consequence: z.string(),
    }),
    incorrect: z.object({
      response: z.string(),
      correction: z.string(),
    }),
  }),
  dataCollection: z.string(),
  masteryCriteria: z.string(),
});
export type Sto = z.infer<typeof StoSchema>;

// —— 目标清单 ——
export const TargetSchema = z.object({
  target: z.string(),
  introDate: z.null(),
  masteryDate: z.null(),
});
export type Target = z.infer<typeof TargetSchema>;

// —— 富媒体 ——
export const ImageSchema = z.object({
  refKey: z.string(),
  prompt: z.string(),
  status: z.enum(['pending', 'done', 'failed']),
  url: z.string().optional(),
});
export type Image = z.infer<typeof ImageSchema>;

// —— AI 需产出的子集(不含 id/schemaVersion/templateType/createdAt/input/images) ——
export const GeneratedLessonSchema = z.object({
  title: z.string(),
  longTermGoal: z.object({
    description: z.string(),
    passCriteria: z.string(),
  }),
  phases: z.array(PhaseSchema).min(1),
  sto: StoSchema,
  targetList: z.array(TargetSchema).min(1),
  sessionSuggestion: z.string().optional(),
});
export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

// —— 完整教案 ——
export const LessonSchema = GeneratedLessonSchema.extend({
  id: z.string(),
  schemaVersion: z.number(),
  templateType: z.literal('dtt'),
  createdAt: z.string(),
  input: LessonInputSchema,
  images: z.array(ImageSchema),
});
export type Lesson = z.infer<typeof LessonSchema>;
