// serve/src/schema/training.ts
import { z } from 'zod';

export const TrainingSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});
export type TrainingSection = z.infer<typeof TrainingSectionSchema>;

export const StructuredContentSchema = z.object({
  summary: z.string(),
  sections: z.array(TrainingSectionSchema).min(1),
});
export type StructuredContent = z.infer<typeof StructuredContentSchema>;

export const QuestionTypeSchema = z.enum(['single', 'multi']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const GeneratedQuestionSchema = z.object({
  type: QuestionTypeSchema,
  question: z.string(),
  options: z.array(z.string()).min(2),
  correctAnswers: z.array(z.number().int().min(0)).min(1),
  explanation: z.string(),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const QuestionBankSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).length(10),
});
export type QuestionBank = z.infer<typeof QuestionBankSchema>;

export const FeedbackSchema = z.object({
  feedback: z.string(),
});

export interface TrainingTopic {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: StructuredContent | null;
  createdAt: string;
}

export interface TrainingQuestion {
  id: string;
  topicId: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  createdAt: string;
}

export interface TrainingAttempt {
  id: string;
  topicId: string;
  userId: string;
  answers: number[][];
  score: number;
  feedback: string;
  createdAt: string;
}
