import type { DbClient } from './client.js';
import type { VideoAnalysis, VideoAnalysisSource } from '../schema/videoAnalysis.js';

// 视频分析报告持久化：与 lessons「单表存整对象 JSON」模式一致（见设计 §4）。
// 列取 id/filename/createdAt/data；列表用到的 source/时长/状态从 data 解析（同 listLessons 思路）。

export type VideoAnalysisListItem = {
  id: string;
  source: VideoAnalysisSource;
  durationSec: number;
  createdAt: string;
  status: VideoAnalysis['status'];
};

type VideoAnalysisRow = {
  id: string;
  filename: string | null;
  createdAt: string;
  data: string;
};

export async function createVideoAnalysesTable(db: DbClient): Promise<void> {
  const idType = db.dialect === 'mysql' ? 'VARCHAR(36) PRIMARY KEY' : 'TEXT PRIMARY KEY';
  const dataType = db.dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  await db.exec(
    `CREATE TABLE IF NOT EXISTS video_analyses(
      id ${idType},
      filename TEXT,
      createdAt TEXT,
      data ${dataType}
    )`,
  );
  const columns: Array<[string, string]> = [
    ['userId', db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT'],
    ['caseId', db.dialect === 'mysql' ? 'VARCHAR(191)' : 'TEXT'],
  ];
  for (const [name, colType] of columns) {
    if (db.dialect === 'mysql') {
      const row = await db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'video_analyses' AND column_name = ?`,
        [name],
      );
      if (!row || row.count === 0) {
        await db.exec(`ALTER TABLE video_analyses ADD COLUMN ${name} ${colType}`);
      }
    } else {
      const existing = await db.all<{ name: string }>(`PRAGMA table_info(video_analyses)`);
      if (!existing.some((c) => c.name === name)) {
        await db.exec(`ALTER TABLE video_analyses ADD COLUMN ${name} ${colType}`);
      }
    }
  }
}

export async function insertVideoAnalysis(
  db: DbClient,
  analysis: VideoAnalysis,
  userId: string,
): Promise<void> {
  await db.run(
    `INSERT INTO video_analyses (id, filename, createdAt, data, userId) VALUES (?, ?, ?, ?, ?)`,
    [analysis.id, analysis.source.filename ?? null, analysis.createdAt, JSON.stringify(analysis), userId],
  );
}

export async function updateVideoAnalysis(db: DbClient, analysis: VideoAnalysis): Promise<void> {
  await db.run(`UPDATE video_analyses SET data = ? WHERE id = ?`, [
    JSON.stringify(analysis),
    analysis.id,
  ]);
}

export async function listVideoAnalyses(db: DbClient, userId: string): Promise<VideoAnalysisListItem[]> {
  const rows = await db.all<VideoAnalysisRow>(
    `SELECT id, filename, createdAt, data FROM video_analyses WHERE userId = ? ORDER BY createdAt DESC`,
    [userId],
  );

  return rows.map((row) => {
    const a = JSON.parse(row.data) as VideoAnalysis;
    return {
      id: a.id,
      source: a.source,
      durationSec: a.durationSec,
      createdAt: a.createdAt,
      status: a.status,
    };
  });
}

export async function getVideoAnalysis(db: DbClient, id: string, userId?: string): Promise<VideoAnalysis | null> {
  const row = userId
    ? await db.get<{ data: string }>(`SELECT data FROM video_analyses WHERE id = ? AND userId = ?`, [id, userId])
    : await db.get<{ data: string }>(`SELECT data FROM video_analyses WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as VideoAnalysis) : null;
}

export async function deleteVideoAnalysis(db: DbClient, id: string, userId?: string): Promise<boolean> {
  const result = userId
    ? await db.run(`DELETE FROM video_analyses WHERE id = ? AND userId = ?`, [id, userId])
    : await db.run(`DELETE FROM video_analyses WHERE id = ?`, [id]);
  return result.changes > 0;
}

// 把一条视频分析关联到某个个案：caseId 同时写入独立列（供按 case 查询）和 data 整对象（供详情读出）。
export async function linkVideoAnalysisCase(
  db: DbClient,
  id: string,
  userId: string,
  caseId: string,
): Promise<boolean> {
  const analysis = await getVideoAnalysis(db, id, userId);
  if (!analysis) return false;
  const updated: VideoAnalysis = { ...analysis, caseId };
  const result = await db.run(`UPDATE video_analyses SET data = ?, caseId = ? WHERE id = ? AND userId = ?`, [
    JSON.stringify(updated),
    caseId,
    id,
    userId,
  ]);
  return result.changes > 0;
}

export async function listVideoAnalysesByCase(db: DbClient, caseId: string): Promise<VideoAnalysis[]> {
  const rows = await db.all<{ data: string }>(
    `SELECT data FROM video_analyses WHERE caseId = ? ORDER BY createdAt DESC`,
    [caseId],
  );
  return rows.map((row) => JSON.parse(row.data) as VideoAnalysis);
}
