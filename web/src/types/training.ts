// 与后端 serve/src/schema/training.ts 同构的纯 TS 类型。

export type TrainingSection = { heading: string; body: string };
export type TrainingStructuredContent = { summary: string; sections: TrainingSection[] };

export type TrainingTopic = {
  id: string;
  title: string;
  rawTranscript: string;
  structuredContent: TrainingStructuredContent | null;
  createdAt: string;
};

export type TrainingQuestionType = 'single' | 'multi' | 'judge';

export type TrainingQuestion = {
  id: string;
  topicId: string;
  type: TrainingQuestionType;
  question: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
  createdAt: string;
};

export type TrainingAttempt = {
  id: string;
  topicId: string;
  userId: string;
  answers: number[][];
  score: number;
  feedback: string;
  createdAt: string;
};
