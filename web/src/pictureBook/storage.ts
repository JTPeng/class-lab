// 绘本打卡记录：存在浏览器 localStorage，getNextCount 给「第 N 次打卡」。
// 移植自 picture-book-reading-card 的 web/js/storage.js。

const KEY = 'pbrc_records';

export interface CheckinRecord {
  date: string;
  title: string;
  stars: number;
  thoughts: string;
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

function readAll(): CheckinRecord[] {
  if (!available()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function getNextCount(): number {
  return readAll().length + 1;
}

export function addRecord(rec: CheckinRecord): void {
  if (!available()) return;
  const all = readAll();
  all.push(rec);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
