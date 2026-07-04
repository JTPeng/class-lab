import type { CaseRecord } from '../db/cases.js';
import type { CaseSessionRecord } from '../db/caseSessions.js';
import type { PictureBookRecord } from '../db/pictureBooks.js';
import type { GameSessionRecord } from '../db/gameSessions.js';
import type { VideoAnalysis, VideoReport } from '../schema/videoAnalysis.js';

const DIMENSION_LABELS: Record<keyof VideoReport['dimensions'], string> = {
  childPerformance: '孩子表现',
  teacherPerformance: '老师表现',
  timelyReward: '及时奖励',
  cooperation: '配合意愿',
  followInstruction: '听指令能力',
};

export const CASE_SUMMARY_SYSTEM_PROMPT = `你是一位经验丰富的自闭症谱系（ASD）教育专家，具备应用行为分析（ABA）与特教康复的专业背景，正在为一位个案做训练情况的专业评估。
你会收到个案的能力评估基线，以及该个案在「执行记录」「绘本打卡」「游戏记录」「视频分析」四类活动上的统计数据。

不要只是罗列或复述数字，而要结合专业视角对数据背后的行为表现做归纳解读，例如：正确率变化反映的能力掌握/泛化情况，教师配合度与进步印象打分反映的行为状态，家长难度反馈反映的任务适配情况，绘本/游戏参与度反映的兴趣与主动性，视频分析五维评级反映的课堂表现细节。

请按以下结构输出，语言专业但通俗易懂，避免空泛套话：
1. 综合评估：结合基线，用专业判断概括个案当前整体发展水平与阶段特征。
2. 各模块表现归纳：分别对四类活动数据做专业解读，指出反映出的能力优势或需关注的行为/情绪信号，而不是简单复述数字；某类活动暂无数据时直接说明暂无记录，不要编造。
3. 需要关注的问题：明确指出数据中值得警惕的信号（如泛化不足、难度错配、配合度下降等）及可能原因。
4. 训练建议：给出至少 3 条具体、可执行的下一步训练/干预建议（如调整难度梯度、增加某维度练习、调整强化方式、家园协同要点等），建议要能落地。

输出 JSON 对象：{"summary": "完整分析文字，按上述 1-4 分段，可用换行区分"}。只输出 JSON，不要有多余文字。`;

export interface CaseSummaryPromptInput {
  record: CaseRecord;
  sessions: CaseSessionRecord[];
  pictureBooks: PictureBookRecord[];
  gameSessions: GameSessionRecord[];
  videoAnalyses: VideoAnalysis[];
}

function summarizeSessions(sessions: CaseSessionRecord[]): string {
  if (sessions.length === 0) return '暂无记录。';
  const ordered = [...sessions].reverse();
  const rates = ordered.map((s) => (s.trialsTotal > 0 ? `${Math.round((s.trialsCorrect / s.trialsTotal) * 100)}%` : '0%'));
  const avgCooperation = ordered.reduce((sum, s) => sum + s.teacherCooperation, 0) / ordered.length;
  const avgProgress = ordered.reduce((sum, s) => sum + s.teacherProgress, 0) / ordered.length;
  const guardianComments = ordered
    .map((s) => s.guardianDifficulty)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  return [
    `共 ${sessions.length} 次，按时间顺序正确率：${rates.join(', ')}。`,
    `教师打分平均：配合度 ${avgCooperation.toFixed(1)} 分，进步印象 ${avgProgress.toFixed(1)} 分。`,
    guardianComments.length > 0 ? `家长难度反馈：${guardianComments.join(', ')}。` : '家长暂未反馈难度。',
  ].join('\n');
}

function summarizePictureBooks(books: PictureBookRecord[]): string {
  if (books.length === 0) return '暂无记录。';
  const recent = books.slice(0, 5).map((b) => `《${b.title}》(${b.date})`);
  return `共 ${books.length} 次打卡，最近：${recent.join('、')}。`;
}

function summarizeGameSessions(sessions: GameSessionRecord[]): string {
  if (sessions.length === 0) return '暂无记录。';
  const recent = sessions.slice(0, 5).map((s) => `${s.gameId} 第${s.level}关 得分${s.score}`);
  return `共 ${sessions.length} 局，最近：${recent.join('、')}。`;
}

function summarizeVideoAnalyses(analyses: VideoAnalysis[]): string {
  const done = analyses.filter((a) => a.status === 'done' && a.report);
  if (done.length === 0) return '暂无记录。';
  const recent = done.slice(0, 5).map((a) => {
    const dims = a.report!.dimensions;
    const ratings = (Object.keys(DIMENSION_LABELS) as (keyof VideoReport['dimensions'])[])
      .map((key) => `${DIMENSION_LABELS[key]}:${dims[key].rating}`)
      .join('/');
    return `[${a.createdAt.slice(0, 10)}] ${ratings}`;
  });
  return `共 ${done.length} 条，最近：${recent.join('；')}。`;
}

export function buildCaseSummaryPrompt(input: CaseSummaryPromptInput): string {
  const { record, sessions, pictureBooks, gameSessions, videoAnalyses } = input;
  return [
    `个案姓名/别称：${record.name}`,
    `能力评估基线：${record.baseline || '（未填写）'}`,
    '',
    '【执行记录】',
    summarizeSessions(sessions),
    '',
    '【绘本打卡记录】',
    summarizePictureBooks(pictureBooks),
    '',
    '【游戏记录】',
    summarizeGameSessions(gameSessions),
    '',
    '【视频分析记录】（五维定性评级：好/一般/待加强）',
    summarizeVideoAnalyses(videoAnalyses),
  ].join('\n');
}
