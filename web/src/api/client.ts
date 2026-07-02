import type { Image, Lesson, LessonInput, LessonListItem } from '../types/lesson';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
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
    body: JSON.stringify(input),
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
    body: JSON.stringify({ refKey, prompt }),
  });
  return image;
}

export const api = {
  generateLesson,
  listLessons,
  getLesson,
  deleteLesson,
  generateImage,
};
