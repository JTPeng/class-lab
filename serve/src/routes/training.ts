import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbClient } from '../db/client.js';
import { getTrainingTopic, listTrainingTopics } from '../db/trainingTopics.js';
import { insertTrainingQuestions, listTrainingQuestionsByTopic } from '../db/trainingQuestions.js';
import { insertTrainingAttempt, listTrainingAttempts } from '../db/trainingAttempts.js';
import { generateTrainingQuestions as defaultGenerateTrainingQuestions } from '../services/generateTrainingQuestions.js';
import { generateTrainingFeedback as defaultGenerateTrainingFeedback } from '../services/generateTrainingFeedback.js';
import type { TrainingQuestion } from '../schema/training.js';

export interface TrainingRoutesDeps {
  db: DbClient;
  generateTrainingQuestions?: typeof defaultGenerateTrainingQuestions;
  generateTrainingFeedback?: typeof defaultGenerateTrainingFeedback;
}

const AttemptBodySchema = z.object({
  userId: z.string().min(1),
  answers: z.array(z.array(z.number().int().min(0))),
});

const AttemptQuerySchema = z.object({ userId: z.string().min(1) });

function isSameAnswer(given: number[], correct: number[]): boolean {
  const g = [...given].sort((a, b) => a - b);
  const c = [...correct].sort((a, b) => a - b);
  return g.length === c.length && g.every((v, idx) => v === c[idx]);
}

function scoreAnswers(questions: TrainingQuestion[], answers: number[][]): number {
  return questions.reduce((score, q, i) => (isSameAnswer(answers[i] ?? [], q.correctAnswers) ? score + 1 : score), 0);
}

export async function registerTrainingRoutes(app: FastifyInstance, deps: TrainingRoutesDeps): Promise<void> {
  const { db } = deps;
  const generateTrainingQuestions = deps.generateTrainingQuestions ?? defaultGenerateTrainingQuestions;
  const generateTrainingFeedback = deps.generateTrainingFeedback ?? defaultGenerateTrainingFeedback;

  app.get('/training/topics', async (_request, reply) => {
    return reply.status(200).send(await listTrainingTopics(db));
  });

  app.get<{ Params: { id: string } }>('/training/topics/:id', async (request, reply) => {
    const topic = await getTrainingTopic(db, request.params.id);
    if (!topic) return reply.status(404).send({ error: 'Topic not found' });
    return reply.status(200).send(topic);
  });

  app.get<{ Params: { id: string } }>('/training/topics/:id/questions', async (request, reply) => {
    const topic = await getTrainingTopic(db, request.params.id);
    if (!topic || !topic.structuredContent) return reply.status(404).send({ error: 'Topic not found' });

    const existing = await listTrainingQuestionsByTopic(db, topic.id);
    if (existing.length > 0) return reply.status(200).send(existing);

    const generated = await generateTrainingQuestions(topic.structuredContent);
    const inserted = await insertTrainingQuestions(db, topic.id, generated);
    return reply.status(200).send(inserted);
  });

  app.post<{ Params: { id: string } }>('/training/topics/:id/attempts', async (request, reply) => {
    const parsed = AttemptBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', issues: parsed.error.issues });

    const questions = await listTrainingQuestionsByTopic(db, request.params.id);
    if (questions.length === 0) return reply.status(404).send({ error: 'Questions not found' });

    const score = scoreAnswers(questions, parsed.data.answers);
    const wrongItems = questions
      .filter((q, i) => !isSameAnswer(parsed.data.answers[i] ?? [], q.correctAnswers))
      .map((q) => ({ question: q.question, explanation: q.explanation }));
    const feedback = await generateTrainingFeedback(score, questions.length, wrongItems);

    const attempt = await insertTrainingAttempt(db, {
      topicId: request.params.id,
      userId: parsed.data.userId,
      answers: parsed.data.answers,
      score,
      feedback,
    });
    return reply.status(200).send(attempt);
  });

  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>(
    '/training/topics/:id/attempts',
    async (request, reply) => {
      const parsed = AttemptQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Missing userId' });
      return reply.status(200).send(await listTrainingAttempts(db, request.params.id, parsed.data.userId));
    },
  );
}
