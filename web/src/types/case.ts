// 与后端 serve/src/db/cases.ts、serve/src/db/caseSessions.ts 同构的纯 TS 类型。

export type CaseRecord = {
  id: string;
  teacherId: string;
  name: string;
  baseline: string;
  targets: string[];
  shareToken: string;
  createdAt: string;
};

export type GuardianDifficulty = 'too_easy' | 'just_right' | 'too_hard';

export type CaseSessionRecord = {
  id: string;
  caseId: string;
  lessonId: string | null;
  createdAt: string;
  trialsTotal: number;
  trialsCorrect: number;
  teacherCooperation: number;
  teacherProgress: number;
  guardianDifficulty: GuardianDifficulty | null;
  guardianInterest: number | null;
  guardianComment: string | null;
  guardianFeedbackAt: string | null;
};

// 与 serve/src/db/gameSessions.ts 同构。
export type GameSessionRecord = {
  id: string;
  userId: string;
  gameId: string;
  caseId: string | null;
  level: number;
  score: number;
  teacherCooperation: number | null;
  teacherProgress: number | null;
  createdAt: string;
};

export type TeacherScoreInput = {
  caseId: string;
  teacherCooperation: number;
  teacherProgress: number;
};
