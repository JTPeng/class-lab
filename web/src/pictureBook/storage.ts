// 绘本打卡记录：本地 localStorage 作同步缓存（按当前登录用户命名空间隔离），
// 登录后额外与后端同步——写入/删除时后台推送，查看历史时优先从后端拉取覆盖本地缓存
// （同 web/src/games/storage.ts 的「本地缓存 + 后端同步」模式）。字段契约见 FIELDS.md。

import { api } from '../api/client';
import type { PictureScene } from '../api/client';

const PREFIX = 'pbrc_records_';
const USER_KEY = 'clab_user'; // AuthContext 写入的当前用户
const MAX_HISTORY = 8; // base64 图片较大，localStorage 容量有限，只保留最近几本

export interface BookRecord {
  id: string;
  title: string;
  thoughts: string;
  stars: number;
  style: string;
  size: string;
  scenes: PictureScene[];
  date: string;
  createdAt: string;
  count: number;
}

function available(): boolean {
  try {
    const t = '__pbrc_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

function currentUserId(): string | null {
  if (!available()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return typeof u.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

function cacheKey(userId: string | null): string {
  return `${PREFIX}${userId ?? 'anon'}`;
}

function readAll(userId: string | null): BookRecord[] {
  if (!available()) return [];
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]');
  } catch {
    return [];
  }
}

// 新记录写在最前面，超出上限时优先丢最旧的（数组末尾）；写入超限（QuotaExceededError）时也逐条丢最旧重试。
function writeAll(userId: string | null, records: BookRecord[]): void {
  if (!available()) return;
  const key = cacheKey(userId);
  let list = records.slice(0, MAX_HISTORY);
  while (list.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, -1);
    }
  }
  localStorage.removeItem(key);
}

export function getHistory(userId?: string | null): BookRecord[] {
  return readAll(userId ?? currentUserId());
}

export function getNextCount(userId?: string | null): number {
  return getHistory(userId).length + 1;
}

export function addRecord(record: BookRecord, userId?: string | null): void {
  const uid = userId ?? currentUserId();
  writeAll(uid, [record, ...readAll(uid)]);
  // 登录后后台推送到后端，失败不影响本地体验。
  if (uid) {
    api.createPictureBook(uid, record).catch(() => {});
  }
}

export function deleteRecord(id: string, userId?: string | null): void {
  const uid = userId ?? currentUserId();
  writeAll(uid, readAll(uid).filter((r) => r.id !== id));
  if (uid) {
    api.deletePictureBookRemote(uid, id).catch(() => {});
  }
}

// 打开历史时调用：优先从后端拉取并覆盖本地缓存展示；后端返回空或不可用（离线等）时回退读本地缓存，
// 避免因单次同步失败（如某条记录未成功写入后端）导致本地已有数据被空结果冲掉（同 games/storage.ts 的 hydrateProgress 模式）。
export async function fetchHistory(userId?: string | null): Promise<BookRecord[]> {
  const uid = userId ?? currentUserId();
  if (!uid) return getHistory(uid);
  try {
    const records = await api.listPictureBooks(uid);
    if (records.length === 0) return getHistory(uid);
    writeAll(uid, records);
    return records;
  } catch {
    return getHistory(uid);
  }
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
