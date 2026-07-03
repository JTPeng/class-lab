// 与后端 serve/src/schema/lesson.ts、serve/src/db/index.ts 同构的纯 TS 类型。
// 两处类型定义并行维护，字段名需保持一致。

// —— 生成输入(留档,便于复现 / 再生成) ——
export type LessonInput = {
  skill: string;
  availableTools: string[];
  context: '机构' | '居家' | '机构/居家';
  reinforcerPref?: string;
  sessionMinutes?: number;
};

// —— 阶段性目标 ——
export type Phase = {
  name: string;
  description: string;
  startDate: null;
  passDate: null;
};

// —— 短期目标 STO ——
export type Sto = {
  teachingMaterials: string;
  objectives: string[];
  strategy: string;
  reinforcementPlan: string;
  procedure: {
    sd: string;
    correct: {
      response: string;
      consequence: string;
    };
    incorrect: {
      response: string;
      correction: string;
    };
  };
  dataCollection: string;
  masteryCriteria: string;
};

// —— 目标清单 ——
export type Target = {
  target: string;
  introDate: null;
  masteryDate: null;
};

// —— 富媒体 ——
export type Image = {
  refKey: string;
  prompt: string;
  status: 'pending' | 'done' | 'failed';
  url?: string;
  reason?: string;
};

// —— AI 需产出的子集(不含 id/schemaVersion/templateType/createdAt/input/images) ——
export type GeneratedLesson = {
  title: string;
  longTermGoal: {
    description: string;
    passCriteria: string;
  };
  phases: Phase[];
  sto: Sto;
  targetList: Target[];
  sessionSuggestion?: string;
};

// —— 完整教案 ——
export type Lesson = GeneratedLesson & {
  id: string;
  schemaVersion: number;
  templateType: 'dtt';
  createdAt: string;
  input: LessonInput;
  images: Image[];
};

// —— 列表项(serve/src/db/index.ts: LessonListItem) ——
export type LessonListItem = {
  id: string;
  title: string;
  skill: string;
  createdAt: string;
  coverUrl?: string;
};
