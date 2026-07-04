import { randomUUID } from 'node:crypto';
import type { DbClient } from './client.js';

// 游戏乐园单局记录：此前游戏历史只存在前端 localStorage（web/src/games/storage.ts），
// 这是游戏首次落地到服务端。caseId/teacherCooperation/teacherProgress 均可空——
// 教师可选择是否把本局关联到某个个案并打分，不打分不影响正常游玩。

export interface GameSessionRecord {
  id: string;
  userId: string;
  gameId: string;
  caseId: string | null;
  level: number;
  score: number;
  teacherCooperation: number | null;
  teacherProgress: number | null;
  createdAt: string;
}

export async function createGameSessionsTable(db: DbClient): Promise<void> {
  const idColType = db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS game_sessions(
      id ${idColType} PRIMARY KEY,
      userId ${idColType},
      gameId TEXT,
      caseId ${idColType},
      level INTEGER,
      score INTEGER,
      teacherCooperation INTEGER,
      teacherProgress INTEGER,
      createdAt TEXT
    )`,
  );
}

export async function insertGameSession(
  db: DbClient,
  input: {
    userId: string;
    gameId: string;
    caseId: string | null;
    level: number;
    score: number;
    teacherCooperation: number | null;
    teacherProgress: number | null;
  },
): Promise<GameSessionRecord> {
  const record: GameSessionRecord = {
    id: randomUUID(),
    userId: input.userId,
    gameId: input.gameId,
    caseId: input.caseId,
    level: input.level,
    score: input.score,
    teacherCooperation: input.teacherCooperation,
    teacherProgress: input.teacherProgress,
    createdAt: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO game_sessions (id, userId, gameId, caseId, level, score, teacherCooperation, teacherProgress, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.userId,
      record.gameId,
      record.caseId,
      record.level,
      record.score,
      record.teacherCooperation,
      record.teacherProgress,
      record.createdAt,
    ],
  );
  return record;
}

export async function listGameSessionsByCase(db: DbClient, caseId: string): Promise<GameSessionRecord[]> {
  return db.all<GameSessionRecord>(`SELECT * FROM game_sessions WHERE caseId = ? ORDER BY createdAt DESC`, [caseId]);
}
