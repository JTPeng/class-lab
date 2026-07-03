import type Database from 'better-sqlite3';
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

export function createVideoAnalysesTable(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS video_analyses(
      id TEXT PRIMARY KEY,
      filename TEXT,
      createdAt TEXT,
      data TEXT
    )`,
  );
}

export function insertVideoAnalysis(db: Database.Database, analysis: VideoAnalysis): void {
  db.prepare(
    `INSERT INTO video_analyses (id, filename, createdAt, data) VALUES (?, ?, ?, ?)`,
  ).run(
    analysis.id,
    analysis.source.filename ?? null,
    analysis.createdAt,
    JSON.stringify(analysis),
  );
}

export function updateVideoAnalysis(db: Database.Database, analysis: VideoAnalysis): void {
  db.prepare(`UPDATE video_analyses SET data = ? WHERE id = ?`).run(
    JSON.stringify(analysis),
    analysis.id,
  );
}

export function listVideoAnalyses(db: Database.Database): VideoAnalysisListItem[] {
  const rows = db
    .prepare(`SELECT id, filename, createdAt, data FROM video_analyses ORDER BY createdAt DESC`)
    .all() as VideoAnalysisRow[];

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

export function getVideoAnalysis(db: Database.Database, id: string): VideoAnalysis | null {
  const row = db.prepare(`SELECT data FROM video_analyses WHERE id = ?`).get(id) as
    | { data: string }
    | undefined;

  return row ? (JSON.parse(row.data) as VideoAnalysis) : null;
}

export function deleteVideoAnalysis(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM video_analyses WHERE id = ?`).run(id);
  return result.changes > 0;
}
