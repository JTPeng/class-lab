# Class-Lab

Class-Lab 是一个多项目工作台，顶部导航栏 Tab 在不同项目模块间切换。目前包含两个模块：

- **DTT 教案**：面向特需儿童（ABA/DTT 训练）的教案生成工具。
- **绘本打卡**：绘本阅读打卡长图卡片生成器。

## 模块一：DTT 教案工具

面向特需儿童（ABA/DTT 训练）的教案生成工具：输入训练目标与现有教具，AI 自动生成一份海报化的 DTT（Discrete Trial Training）教案。

- 文字主链路：表单输入 → AI 生成结构化教案 → 保存/查看/删除。
- 海报详情页：教案以海报排版呈现。
- 交互 1：回合流程演示（SD 呈现 → 孩子正确/错误 → 强化/纠正 → 再来一回合）。
- 交互 2：目标清单图卡轮播（同组多重范例切换 + 放大查看）。
- 图配：可对每个目标单独触发 qwen-image 生成配图。

## 模块二：绘本打卡图卡

填写书名、心得、评分，选择 AI 画风与页数，由通义千问编排连贯故事分镜、通义万相逐场景生成插画，拼成一张赛博朋克风长图绘本卡片，长按保存或二维码局域网分享。

- 主链路：表单 → qwen-turbo 编分镜 → wanx 逐场景串行生图 → 拼长图卡片。
- 打卡累计次数记录在浏览器 localStorage（第 N 次打卡）。
- 长图支持长按保存或二维码分享（后端临时存图于 `serve/shared/`，每次启动清空，同一局域网内扫码查看）。
- 「扫码上手机」二维码用后端返回的局域网 IP + 当前前端端口拼成，手机连同一 Wi-Fi 扫码即可打开。
- 生成能力需在 `serve/.env` 配置 `DASHSCOPE_API_KEY`（阿里百炼 DashScope 原生接口 Key）。

## 环境要求

- Node.js 22+

## 后端 `serve/`

```bash
cd serve
npm install
cp .env.example .env
```

编辑 `.env`，填入以下变量：

| 变量 | 说明 |
| --- | --- |
| `MAAS_API_KEY` | 阿里百炼 MaaS API Key |
| `MAAS_BASE_URL` | 文本模型 OpenAI 兼容 base URL（`.../compatible-mode/v1`） |
| `TEXT_MODEL` | 文本模型名，如 `qwen3.7-max` |
| `IMAGE_MODEL` | 配图模型名，如 `qwen-image-2.0-pro-2026-06-22` |
| `DASHSCOPE_BASE_URL` | DashScope 多模态生成接口 host（DTT 图配用） |
| `DASHSCOPE_API_KEY` | 阿里百炼 DashScope 原生接口 Key（绘本打卡模块用） |
| `PORT` | 后端服务端口，默认 `8787` |

启动开发服务：

```bash
npm run dev
```

后端监听 `http://localhost:8787`。

## 前端 `web/`

```bash
cd web
npm install
npm run dev
```

前端监听 `http://localhost:5173`，通过 Vite 代理将 `/api` 与 `/uploads` 转发到后端 `:8787`。

> **注意**：如果在 `npm run dev` 运行期间修改了 `web/tailwind.config.js`，需要重启 Vite 开发服务器——HMR 不会可靠地重新读取 Tailwind 配置。生产构建 `npm run build` 不受此问题影响。

## 使用方式

1. 打开 `http://localhost:5173`。
2. 点击「新建教案」，填写训练目标、现有教具等表单信息。
3. 点击生成，等待约 30-60 秒（推理模型生成教案文本）。
4. 查看生成的海报化教案详情，体验回合流程演示与图卡轮播交互。
5. 可选：在目标卡片上点击「生成配图」，为该目标触发 qwen-image 配图生成，耗时约 60 秒/张。
6. 在首页教案列表可对每份教案执行删除操作。

## 模型与存储说明

- 文本模型：`qwen3.7-max`（阿里百炼 MaaS，OpenAI 兼容接口）。
- 图片模型：`qwen-image-2.0-pro-2026-06-22`（DashScope 多模态生成同步接口）。
- 生成的图片会下载到 `serve/uploads/`（已加入 `.gitignore`）并通过 `/uploads/` 静态路径对外提供，教案记录中保存本地路径（因模型返回的 OSS 签名 URL 约 2 小时后过期，不能直接持久化引用）。

## 测试

- 后端单测（vitest）：

  ```bash
  cd serve
  npm test
  ```

- 前端：暂无测试。
