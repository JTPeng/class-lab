// 报告下载：HTML（自包含静态文件，图片用绝对 URL，需服务仍在运行）与 PDF（html2canvas 截图 + jsPDF 分页拼接）。
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { VideoAnalysis } from '../types/video'
import { formatClock } from './video'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${window.location.origin}${path}`
}

// 拼一份自包含的静态 HTML 报告（内联样式，图片用绝对 URL）。
export function buildReportHtml(analysis: VideoAnalysis): string {
  const { report } = analysis
  if (!report) return ''

  const dims = [
    ['孩子表现', report.dimensions.childPerformance],
    ['老师表现', report.dimensions.teacherPerformance],
    ['及时奖励', report.dimensions.timelyReward],
    ['配合意愿', report.dimensions.cooperation],
    ['听指令能力', report.dimensions.followInstruction],
  ] as const

  const ratingColor: Record<string, string> = { 好: '#059669', 一般: '#d97706', 待加强: '#e11d48' }
  const ratingPct: Record<string, number> = { 好: 100, 一般: 66, 待加强: 33 }

  const overviewHtml = `<h2>五维评价总览</h2>${dims
    .map(
      ([label, d]) =>
        `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><span style="width:80px;flex-shrink:0;font-size:13px;font-weight:bold;color:#44403c">${label}</span><div style="flex:1;height:10px;background:#f1f5f9;border-radius:6px;overflow:hidden"><div style="height:100%;width:${ratingPct[d.rating] ?? 33}%;background:${ratingColor[d.rating] ?? '#000'}"></div></div><span style="width:44px;flex-shrink:0;text-align:right;font-size:12px;font-weight:bold;color:${ratingColor[d.rating] ?? '#000'}">${d.rating}</span></div>`,
    )
    .join('')}`

  const encouragementHtml = report.encouragement
    ? `<div style="background:#fffbeb;border-top:3px solid #f59e0b;border-radius:12px;padding:16px 20px;margin-top:24px"><div style="font-weight:bold;color:#92400e;margin-bottom:6px">💛 给老师的话</div><div style="font-size:14px;color:#44403c">${escapeHtml(report.encouragement)}</div></div>`
    : ''

  const needsReviewHtml =
    report.needsReview && report.needsReview.length > 0
      ? `<div style="border-top:3px solid #f59e0b;border-radius:12px;padding:16px 20px;margin-top:16px"><div style="font-weight:bold;color:#1c1917;margin-bottom:6px">⚠️ 需人工确认</div><ul style="margin:0;padding-left:20px;font-size:13px;color:#44403c">${report
          .needsReview.map((item) => `<li style="margin-bottom:4px">${escapeHtml(item)}</li>`)
          .join('')}</ul></div>`
      : ''

  const statsHtml = report.stats
    ? `<h2>行为统计</h2>
      <h3>奖励类型占比</h3>
      ${
        report.stats.rewardBreakdown.length === 0
          ? '<p>本节课各时段均未识别到明显的奖励动作。</p>'
          : report.stats.rewardBreakdown
              .map((b) => {
                const total = report.stats!.rewardBreakdown.reduce((s, x) => s + x.count, 0)
                const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
                return `<div style="margin-bottom:8px"><div style="font-size:12px;color:#57534e;margin-bottom:2px">${escapeHtml(b.type)} — ${b.count} 段 · ${pct}%</div><div style="height:10px;background:#f1f5f9;border-radius:6px;overflow:hidden"><div style="height:100%;width:${Math.max(pct, 3)}%;background:#3b82f6"></div></div></div>`
              })
              .join('')
      }
      <h3>指令响应率</h3>
      ${
        report.stats.instructionTotal === 0
          ? '<p>本节课各时段均未识别到明显的指令下达。</p>'
          : `<div style="font-size:12px;color:#57534e;margin-bottom:2px">孩子响应 ${report.stats.instructionResponded}/${report.stats.instructionTotal} 段 · ${Math.round((report.stats.instructionResponded / report.stats.instructionTotal) * 100)}%</div><div style="height:10px;background:#f1f5f9;border-radius:6px;overflow:hidden"><div style="height:100%;width:${Math.max(Math.round((report.stats.instructionResponded / report.stats.instructionTotal) * 100), 3)}%;background:#3b82f6"></div></div>`
      }`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>课堂视频分析报告</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1c1917; line-height: 1.7; }
  h1 { font-size: 24px; }
  h2 { font-size: 18px; margin-top: 32px; border-top: 3px solid #fb923c; padding-top: 12px; }
  h3 { font-size: 14px; color: #44403c; margin: 16px 0 8px; }
  .tag { display: inline-block; background: #ffedd5; color: #c2410c; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: bold; margin: 0 4px 4px 0; }
  .dim { border: 1px solid #f1f5f9; border-left: 4px solid #d6d3d1; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; }
  .dim .rating { font-weight: bold; }
  .timeline-item { display: flex; gap: 12px; margin-bottom: 14px; }
  .timeline-item video { width: 160px; height: 90px; object-fit: cover; border-radius: 8px; flex-shrink: 0; background: #1c1917; }
  .timeline-time { display: inline-block; background: #ffedd5; color: #c2410c; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; background: #fafaf9; border-radius: 12px; padding: 16px; }
</style>
</head>
<body>
  <h1>课堂视频分析报告</h1>
  <p style="color:#78716c;font-size:12px">时长 ${formatClock(analysis.durationSec)} ・ 生成于 ${new Date(analysis.createdAt).toLocaleString('zh-CN')}${analysis.style ? ` ・ 风格：${escapeHtml(analysis.style)}` : ''}</p>
  <p>${escapeHtml(report.summary)}</p>
  <div>${report.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>

  ${encouragementHtml}
  ${needsReviewHtml}

  ${overviewHtml}

  <h2>五维评价</h2>
  ${dims
    .map(
      ([label, d]) =>
        `<div class="dim" style="border-left-color:${ratingColor[d.rating] ?? '#d6d3d1'}"><div>${label} — <span class="rating" style="color:${ratingColor[d.rating] ?? '#000'}">${d.rating}</span></div><div style="font-size:13px;color:#44403c;margin-top:4px">${escapeHtml(d.notes)}</div></div>`,
    )
    .join('')}

  ${statsHtml}

  ${
    report.timeline.length > 0
      ? `<h2>时间轴证据</h2>${report.timeline
          .map(
            (ev) =>
              `<div class="timeline-item">${ev.clipUrl ? `<video src="${absoluteUrl(ev.clipUrl)}" controls muted preload="metadata"></video>` : ''}<div><div class="timeline-time">${formatClock(ev.atSec)}</div><div style="font-size:13px">${escapeHtml(ev.text)}</div></div></div>`,
          )
          .join('')}`
      : ''
  }

  <h2>报告草稿</h2>
  <pre>${escapeHtml(report.draft)}</pre>
</body>
</html>`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadReportHtml(analysis: VideoAnalysis, filename: string): void {
  const html = buildReportHtml(analysis)
  triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
}

// 把报告 DOM 节点截图后分页拼进 PDF（A4，按截图与页面宽高比切分）。
export async function downloadReportPdf(node: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(node, { useCORS: true, scale: 2, backgroundColor: '#ffffff' })
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const imgData = canvas.toDataURL('image/png')

  let renderedHeight = 0
  let first = true
  while (renderedHeight < imgHeight) {
    if (!first) pdf.addPage()
    first = false
    // jsPDF 没有裁剪 API，靠负偏移把已渲染部分推出页面顶部之外，实现分页效果。
    pdf.addImage(imgData, 'PNG', 0, -renderedHeight, imgWidth, imgHeight)
    renderedHeight += pageHeight
  }
  pdf.save(filename)
}
