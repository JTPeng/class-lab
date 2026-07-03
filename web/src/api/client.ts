import type { Image, Lesson, LessonInput, LessonListItem } from '../types/lesson';
import type { ReportStyle, VideoAnalysis, VideoAnalysisListItem } from '../types/video';
import { videoMock } from './videoMock';

const BASE = '/api';

// 后端 /api/video/* 未就绪时用前端 Mock 预览全流程；接口上线后改为 false 即联调（页面无需改动）。
// 后端已就绪（serve/src/routes/videoAnalysis.ts），联调走真实接口。
const USE_VIDEO_MOCK = false;

async function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const { method, body } = options ?? {};
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function generateLesson(input: LessonInput): Promise<Lesson> {
  return request<Lesson>('/lessons/generate', {
    method: 'POST',
    body: input,
  });
}

function listLessons(): Promise<LessonListItem[]> {
  return request<LessonListItem[]>('/lessons');
}

function getLesson(id: string): Promise<Lesson> {
  return request<Lesson>(`/lessons/${id}`);
}

function deleteLesson(id: string): Promise<void> {
  return request<void>(`/lessons/${id}`, { method: 'DELETE' });
}

async function generateImage(lessonId: string, refKey: string, prompt: string): Promise<Image> {
  const { image } = await request<{ image: Image }>(`/lessons/${lessonId}/images`, {
    method: 'POST',
    body: { refKey, prompt },
  });
  return image;
}

// ===== 绘本打卡模块 =====

export interface PictureScene {
  text: string;
  image: string;
}

export interface PicturebookInput {
  title: string;
  thoughts: string;
  style: string;
  n: number;
  size: string;
}

function generatePicturebook(input: PicturebookInput): Promise<{ scenes: PictureScene[] }> {
  return request<{ scenes: PictureScene[] }>('/picturebook/generate', {
    method: 'POST',
    body: input,
  });
}

function sharePicture(image: string): Promise<{ url: string }> {
  return request<{ url: string }>('/picturebook/share', { method: 'POST', body: { image } });
}

function getLanIp(): Promise<{ ip: string | null }> {
  return request<{ ip: string | null }>('/lan-url');
}

// ===== 用户 / 登录 / 模块数据 =====

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  role: string;
  meta: string | null;
}

function login(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>('/auth/login', { method: 'POST', body: { username, password } });
}

// 取某用户在某模块某 key 的数据；无数据时 data 为 null。
function getModuleData<T>(userId: string, module: string, key: string): Promise<{ data: T | null }> {
  return request<{ data: T | null }>(`/users/${userId}/modules/${module}/${key}`);
}

function putModuleData(userId: string, module: string, key: string, data: unknown): Promise<void> {
  return request<void>(`/users/${userId}/modules/${module}/${key}`, { method: 'PUT', body: { data } });
}

// ===== 视频分析模块 =====

// 文件入口走 multipart（FormData）；不手动设 Content-Type，交给浏览器带 boundary。
// style 须在 file 之前 append，后端才能从 file.fields 读到（见 routes/videoAnalysis.ts 注释）。
function createVideoAnalysisFromFile(file: File, style?: ReportStyle): Promise<{ id: string }> {
  if (USE_VIDEO_MOCK) return videoMock.createFromFile(file, style);
  const form = new FormData();
  if (style) form.append('style', style);
  form.append('file', file);
  return fetch(`${BASE}/video/analyses`, { method: 'POST', body: form }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ id: string }>;
  });
}

function createVideoAnalysisFromUrl(url: string, style?: ReportStyle): Promise<{ id: string }> {
  if (USE_VIDEO_MOCK) return videoMock.createFromUrl(url, style);
  return request<{ id: string }>('/video/analyses', { method: 'POST', body: { url, style } });
}

function getVideoJob(id: string): Promise<VideoAnalysis> {
  if (USE_VIDEO_MOCK) return videoMock.getVideoJob(id);
  return request<VideoAnalysis>(`/video/jobs/${id}`);
}

function listVideoAnalyses(): Promise<VideoAnalysisListItem[]> {
  if (USE_VIDEO_MOCK) return videoMock.listVideoAnalyses();
  return request<VideoAnalysisListItem[]>('/video/analyses');
}

function getVideoAnalysis(id: string): Promise<VideoAnalysis> {
  if (USE_VIDEO_MOCK) return videoMock.getVideoAnalysis(id);
  return request<VideoAnalysis>(`/video/analyses/${id}`);
}

function deleteVideoAnalysis(id: string): Promise<void> {
  if (USE_VIDEO_MOCK) return videoMock.deleteVideoAnalysis(id);
  return request<void>(`/video/analyses/${id}`, { method: 'DELETE' });
}

// 后端错误响应体形如 {"error":"..."}，request() 会把整段响应体作为 Error.message 抛出。
// 该工具从中提取出 error 文案，取不到时回退到 fallback。
export function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* 非 JSON，走回退 */
  }
  return raw || fallback;
}

export const api = {
  generateLesson,
  listLessons,
  getLesson,
  deleteLesson,
  generateImage,
  generatePicturebook,
  sharePicture,
  getLanIp,
  login,
  getModuleData,
  putModuleData,
  createVideoAnalysisFromFile,
  createVideoAnalysisFromUrl,
  getVideoJob,
  listVideoAnalyses,
  getVideoAnalysis,
  deleteVideoAnalysis,
};
