import os from 'node:os';

// 返回第一个非回环的内网 IPv4 地址；找不到返回 null（未连网时二维码/分享功能降级）。
export function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return null;
}
