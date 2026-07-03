// 游戏进度：分数与关卡。localStorage 作同步缓存（游戏页同步读取，无需改造为异步），
// 登录后额外与后端同步——保存时后台推送，登录时从后端 hydrate 回本地缓存。
// 缓存 key 按当前用户命名空间隔离；未登录用 'anon'，登录后归属到该用户。

import { api } from '../api/client';

const PREFIX = 'clab_game_';
const USER_KEY = 'clab_user'; // AuthContext 写入的当前用户

// 已知可玩游戏，登录时用于从后端批量 hydrate。
export const KNOWN_GAME_IDS = ['animal-sound', 'shape-match'];

export interface GameProgress {
  level: number; // 当前关卡，从 1 开始
  score: number; // 累计分数
  best: number; // 历史最高分
}

const DEFAULT: GameProgress = { level: 1, score: 0, best: 0 };

function available(): boolean {
  try {
    const t = '__clab_test__';
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

function cacheKey(gameId: string, userId: string | null): string {
  return `${PREFIX}${userId ?? 'anon'}_${gameId}`;
}

function normalize(p: Partial<GameProgress> | null | undefined): GameProgress {
  if (!p) return { ...DEFAULT };
  return {
    level: typeof p.level === 'number' && p.level >= 1 ? p.level : 1,
    score: typeof p.score === 'number' ? p.score : 0,
    best: typeof p.best === 'number' ? p.best : 0,
  };
}

export function loadProgress(gameId: string): GameProgress {
  if (!available()) return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(cacheKey(gameId, currentUserId()));
    return normalize(raw ? (JSON.parse(raw) as Partial<GameProgress>) : null);
  } catch {
    return { ...DEFAULT };
  }
}

export function saveProgress(gameId: string, progress: GameProgress): void {
  const best = Math.max(progress.best, progress.score);
  const next: GameProgress = { ...progress, best };
  const userId = currentUserId();
  if (available()) {
    localStorage.setItem(cacheKey(gameId, userId), JSON.stringify(next));
  }
  // 登录后后台推送到后端，失败不影响本地体验。
  if (userId) {
    api.putModuleData(userId, 'games', gameId, next).catch(() => {});
  }
}

// 登录成功后调用：把后端各游戏进度拉回本地缓存（覆盖该用户命名空间）。
export async function hydrateProgress(userId: string): Promise<void> {
  if (!available()) return;
  await Promise.all(
    KNOWN_GAME_IDS.map(async (gameId) => {
      try {
        const { data } = await api.getModuleData<GameProgress>(userId, 'games', gameId);
        if (data) {
          localStorage.setItem(cacheKey(gameId, userId), JSON.stringify(normalize(data)));
        }
      } catch {
        /* 后端不可用则保留本地缓存 */
      }
    }),
  );
}
