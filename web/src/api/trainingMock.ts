// 培训测评前端 Mock：后端 /api/training/* 未就绪时，在浏览器完整预览
// 「学习列表 → 详情 → 测评答题 → 交卷反馈」全流程。后端上线后把 client.ts 的
// USE_TRAINING_MOCK 改为 false 即弃用本文件。数据存内存，刷新后作答记录会丢失。

import type { TrainingAttempt, TrainingQuestion, TrainingTopic } from '../types/training'

const topics: TrainingTopic[] = [
  {
    id: 'mock-topic-1',
    title: 'DTT 回合式教学基础',
    rawTranscript: '（示例逐字稿，省略）',
    structuredContent: {
      summary: 'DTT（回合式教学）通过「指令-反应-结果」的固定结构，帮助孩子在高重复、高结构化的环境中习得新技能。',
      sections: [
        { heading: '什么是回合式教学', body: '每个回合包含清晰指令、孩子反应、及时结果反馈三个部分，回合之间有明确的开始与结束。' },
        { heading: '指令的下达要求', body: '指令要简短、一致、只出现一次，避免重复或叠加多条指令，给孩子留出反应时间。' },
        { heading: '提示层级', body: '从无提示开始，逐步在孩子未正确反应时给予肢体、手势、口头等不同层级的提示，并逐步撤除提示。' },
        { heading: '强化的时机', body: '正确反应后应在 1-2 秒内给予强化，强化物要与孩子的反应建立即时关联，避免延迟强化。' },
      ],
    },
    createdAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 'mock-topic-2',
    title: '课堂强化策略与代币制度',
    rawTranscript: '（示例逐字稿，省略）',
    structuredContent: {
      summary: '强化是行为塑造的核心工具，代币制度能帮助孩子逐步从即时强化过渡到延迟强化。',
      sections: [
        { heading: '一级强化物与二级强化物', body: '一级强化物（如食物）直接满足生理需求；二级强化物（如代币、表扬）需要通过配对建立价值。' },
        { heading: '代币制度的搭建', body: '设定清晰的代币获取规则和兑换目标，兑换周期从短到长逐步拉长，避免一开始就设置过高门槛。' },
        { heading: '强化物的轮换', body: '定期评估孩子的偏好，避免单一强化物导致饱厌效应，可通过偏好评估表定期更新强化物清单。' },
      ],
    },
    createdAt: '2026-06-21T09:00:00.000Z',
  },
  {
    id: 'mock-topic-3',
    title: '问题行为的功能评估',
    rawTranscript: '（示例逐字稿，省略）',
    structuredContent: {
      summary: '问题行为往往具有功能性，常见功能包括获取关注、逃避任务、获取物品和自我刺激，识别功能是制定干预方案的前提。',
      sections: [
        { heading: '四种常见功能', body: '获取关注、逃避/回避、获取实物或活动、感觉刺激，一个行为也可能同时具有多种功能。' },
        { heading: 'ABC 记录法', body: '记录行为发生前的前提事件（A）、行为本身（B）、行为发生后的结果（C），通过多次记录归纳出行为规律。' },
        { heading: '基于功能的干预', body: '干预方案必须针对识别出的功能设计，例如逃避功能的问题行为应结合任务难度调整与替代沟通方式。' },
      ],
    },
    createdAt: '2026-06-22T09:00:00.000Z',
  },
]

// key: topicId，value: 该主题已生成的题库（模拟「首次生成后落库复用」）。
const questionBank = new Map<string, TrainingQuestion[]>()

// key: `${topicId}:${userId}`，value: 该用户在该主题下的作答历史。
const attempts = new Map<string, TrainingAttempt[]>()

function buildQuestions(topicId: string): TrainingQuestion[] {
  const now = new Date().toISOString()
  const pool: Omit<TrainingQuestion, 'id' | 'topicId' | 'createdAt'>[] = [
    { type: 'single', question: '一个完整的 DTT 回合应包含哪三个部分？', options: ['指令、反应、结果', '示范、模仿、强化', '评估、干预、复评', '前提、行为、后果'], correctAnswers: [0], explanation: 'DTT 回合的核心结构是「指令-反应-结果」，每个回合有明确的开始与结束。' },
    { type: 'single', question: '给孩子下达指令时，正确的做法是？', options: ['连续重复三次指令加深印象', '指令简短一致，只出现一次', '同时给出两条指令提高效率', '语气要严厉才有效'], correctAnswers: [1], explanation: '指令应简短、一致、只出现一次，避免重复或叠加，给孩子留出反应时间。' },
    { type: 'multi', question: '以下哪些属于提示层级中常见的提示方式？', options: ['肢体提示', '手势提示', '口头提示', '完全不提示'], correctAnswers: [0, 1, 2], explanation: '肢体、手势、口头都是常见提示方式，提示要逐步撤除，"完全不提示"是无提示状态而非一种提示方式。' },
    { type: 'single', question: '强化应在孩子正确反应后多久内给出，才能建立最强的关联？', options: ['1-2 秒内', '10 秒左右', '回合结束后统一给', '下一节课再给'], correctAnswers: [0], explanation: '及时强化（1-2 秒内）能让孩子将正确反应与强化建立最直接的因果关联。' },
    { type: 'multi', question: '关于一级强化物与二级强化物，下列说法正确的是？', options: ['一级强化物如食物直接满足生理需求', '二级强化物如代币需要通过配对建立价值', '二级强化物永远比一级强化物有效', '两者可以配合使用'], correctAnswers: [0, 1, 3], explanation: '一级强化物直接满足生理需求，二级强化物需配对建立价值，二者并非谁绝对更有效，实践中常配合使用。' },
    { type: 'single', question: '代币制度设计的合理原则是？', options: ['一开始就设置很高的兑换门槛', '兑换周期从短到长逐步拉长', '代币规则可以随时随意更改', '所有孩子用同一套固定代币数量'], correctAnswers: [1], explanation: '应从短周期、低门槛开始，逐步拉长兑换周期，帮助孩子过渡到延迟强化。' },
    { type: 'single', question: '为什么要定期做强化物偏好评估？', options: ['为了减少强化物种类', '避免单一强化物导致饱厌效应', '让老师有更多选择权', '和干预效果无关'], correctAnswers: [1], explanation: '长期使用同一强化物容易饱厌，定期评估偏好可以及时更新强化物清单，维持强化效果。' },
    { type: 'multi', question: '问题行为常见的功能包括哪些？', options: ['获取关注', '逃避/回避任务', '获取实物或活动', '感觉刺激'], correctAnswers: [0, 1, 2, 3], explanation: '这四种是问题行为最常见的功能，一个行为可能同时具备多种功能。' },
    { type: 'single', question: 'ABC 记录法中的 "A" 代表什么？', options: ['行为（Action）', '前提事件（Antecedent）', '评估（Assessment）', '答案（Answer）'], correctAnswers: [1], explanation: 'ABC 记录法记录前提事件（Antecedent）、行为（Behavior）、结果（Consequence）。' },
    { type: 'single', question: '针对以"逃避任务"为功能的问题行为，更合适的干预方向是？', options: ['单纯增加惩罚力度', '结合任务难度调整与替代沟通方式', '完全取消所有任务要求', '忽略行为直到自然消失'], correctAnswers: [1], explanation: '干预方案应针对识别出的功能设计，逃避功能的问题行为宜结合任务难度调整和教授替代沟通方式。' },
  ]
  return pool.map((q, i) => ({ ...q, id: `${topicId}-q${i}`, topicId, createdAt: now }))
}

function isSameAnswer(given: number[], correct: number[]): boolean {
  const g = [...given].sort((a, b) => a - b)
  const c = [...correct].sort((a, b) => a - b)
  return g.length === c.length && g.every((v, idx) => v === c[idx])
}

function buildFeedback(score: number, total: number): string {
  if (score === total) return `太棒了，本次满分 ${score}/${total}！各个知识点都掌握得很扎实，继续保持这份专注和细心。`
  if (score >= total * 0.7) return `本次得分 ${score}/${total}，整体掌握不错。可以重点回顾一下答错的题目对应的知识点，巩固后会更稳固。感谢你在培训上投入的时间和精力！`
  return `本次得分 ${score}/${total}，说明这部分内容还需要多花些时间消化，别有压力，可以对照错题的解析再复习一遍相关章节。每一次学习都是进步，加油！`
}

export const trainingMock = {
  listTrainingTopics(): Promise<TrainingTopic[]> {
    return Promise.resolve(topics)
  },
  getTrainingTopic(id: string): Promise<TrainingTopic> {
    const topic = topics.find((t) => t.id === id)
    if (!topic) return Promise.reject(new Error(JSON.stringify({ error: '未找到该培训主题' })))
    return Promise.resolve(topic)
  },
  getTrainingQuestions(topicId: string): Promise<TrainingQuestion[]> {
    const topic = topics.find((t) => t.id === topicId)
    if (!topic) return Promise.reject(new Error(JSON.stringify({ error: '未找到该培训主题' })))
    let questions = questionBank.get(topicId)
    if (!questions) {
      questions = buildQuestions(topicId)
      questionBank.set(topicId, questions)
    }
    return Promise.resolve(questions)
  },
  submitTrainingAttempt(topicId: string, userId: string, answers: number[][]): Promise<TrainingAttempt> {
    const questions = questionBank.get(topicId)
    if (!questions) return Promise.reject(new Error(JSON.stringify({ error: '题库尚未生成' })))
    const score = questions.reduce((s, q, i) => (isSameAnswer(answers[i] ?? [], q.correctAnswers) ? s + 1 : s), 0)
    const attempt: TrainingAttempt = {
      id: crypto.randomUUID(),
      topicId,
      userId,
      answers,
      score,
      feedback: buildFeedback(score, questions.length),
      createdAt: new Date().toISOString(),
    }
    const key = `${topicId}:${userId}`
    attempts.set(key, [attempt, ...(attempts.get(key) ?? [])])
    return Promise.resolve(attempt)
  },
}
