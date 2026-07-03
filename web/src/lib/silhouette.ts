// 把纯白背景的彩色图转成黑色剪影（影子）。
// canvas 抠白底→透明、主体→纯黑，返回 dataURL。
// 图片需同源或带 CORS 头（配合 img.crossOrigin='anonymous'），否则 canvas 被污染、toDataURL 抛错。
// 按 url 缓存结果 Promise，避免同一张图重复处理。

const cache = new Map<string, Promise<string | null>>()

// 生成失败（跨域污染、加载失败等）返回 null，调用方回退到 emoji 剪影。
export function makeSilhouette(url: string): Promise<string | null> {
  const hit = cache.get(url)
  if (hit) return hit

  const task = new Promise<string | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const px = image.data
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i]
          const g = px[i + 1]
          const b = px[i + 2]
          if (r > 240 && g > 240 && b > 240) {
            px[i + 3] = 0 // 接近纯白 → 透明背景
          } else {
            px[i] = 0
            px[i + 1] = 0
            px[i + 2] = 0 // 其余像素 → 纯黑主体
          }
        }
        ctx.putImageData(image, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })

  cache.set(url, task)
  return task
}
