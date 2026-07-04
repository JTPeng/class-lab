import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { loadProgress, saveProgress, loadHistory, addRecord } from '../games/storage'
import { poseForLevel, poseImageUrl, scorePose, type Landmark } from '../games/poses'
import GameHistoryChart from '../components/GameHistoryChart'

// 「跟我做动作」游戏。
// 左侧是 AI 生成的卡通动作参考图，右侧是摄像头。小朋友模仿动作，浏览器用 MediaPipe
// 提取骨骼点算相似度；相似度≥阈值且连续保持约 2 秒即通关 +10 分，进入下一关。
// 分数与关卡自动存 storage（localStorage + 登录后端同步）。

const GAME_ID = 'pose-mimic'
const SCORE_PER_POSE = 10
const MATCH_THRESHOLD = 75 // 相似度达标线（0–100）
const HOLD_MS = 2000 // 需保持的时长
const DETECT_INTERVAL_MS = 100 // 检测节流，约 10fps

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

type Phase = 'loading' | 'ready' | 'error'

function PoseMimic() {
  const saved = useMemo(() => loadProgress(GAME_ID), [])
  const [level, setLevel] = useState(saved.level)
  const [score, setScore] = useState(saved.score)
  const [best, setBest] = useState(saved.best)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [similarity, setSimilarity] = useState(0)
  const [holdMs, setHoldMs] = useState(0)
  const [levelDone, setLevelDone] = useState(false)
  const [history, setHistory] = useState(() => loadHistory(GAME_ID))

  const videoRef = useRef<HTMLVideoElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const lastDetectRef = useRef(0)
  const levelRef = useRef(level)
  const doneRef = useRef(false)

  const pose = poseForLevel(level)

  // 关卡变化：同步给检测循环用的 ref，并重置本关状态。
  useEffect(() => {
    levelRef.current = level
    doneRef.current = false
    holdStartRef.current = null
    setHoldMs(0)
    setSimilarity(0)
    setLevelDone(false)
  }, [level])

  // 分数/关卡变化即持久化。
  useEffect(() => {
    saveProgress(GAME_ID, { level, score, best })
  }, [level, score, best])

  // 初始化：开摄像头 + 加载 MediaPipe 模型 + 启动检测循环（仅一次，全程保持挂载）。
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setPhase('ready')
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrMsg(
          /permission|denied|notallowed/i.test(msg)
            ? '需要摄像头权限才能玩哦，请在浏览器允许摄像头后刷新页面～'
            : `摄像头或模型加载失败：${msg}`,
        )
        setPhase('error')
      }
    }

    function loop() {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (video && landmarker && video.readyState >= 2) {
        const now = performance.now()
        if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
          lastDetectRef.current = now
          const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now)
          const landmarks = result.landmarks?.[0] as Landmark[] | undefined
          const current = poseForLevel(levelRef.current)
          const sim = scorePose(landmarks, current)
          setSimilarity(sim)

          if (!doneRef.current) {
            if (sim >= MATCH_THRESHOLD) {
              if (holdStartRef.current == null) holdStartRef.current = now
              const held = now - holdStartRef.current
              setHoldMs(held)
              if (held >= HOLD_MS) {
                doneRef.current = true
                setLevelDone(true)
              }
            } else {
              holdStartRef.current = null
              setHoldMs(0)
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 通关结算：加分（函数式更新，避免闭包旧值 / 重复加分）。
  useEffect(() => {
    if (!levelDone) return
    setScore((s) => {
      const ns = s + SCORE_PER_POSE
      setBest((b) => Math.max(b, ns))
      return ns
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelDone])

  function nextLevel() {
    addRecord(GAME_ID, { level, score, timestamp: Date.now() })
    setHistory(loadHistory(GAME_ID))
    setLevel((l) => l + 1)
  }

  function restart() {
    if (!window.confirm('确定要从第 1 关重新开始？当前分数会清零（最高分保留）。')) return
    setScore(0)
    setLevel(1)
    doneRef.current = false
    holdStartRef.current = null
    setLevelDone(false)
    setHoldMs(0)
    setSimilarity(0)
  }

  const holdPct = Math.min(100, Math.round((holdMs / HOLD_MS) * 100))
  const hit = similarity >= MATCH_THRESHOLD

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-brand-100/60 to-brand-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 顶部状态条 */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/games" className="text-sm font-bold text-brand-600 hover:underline">
            ← 返回游戏乐园
          </Link>
          <button
            type="button"
            onClick={restart}
            className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-full px-3 py-1 transition-colors"
          >
            重新开始
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="关卡" value={`第 ${level} 关`} />
          <Stat label="得分" value={`${score}`} />
          <Stat label="最高分" value={`${best}`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 参考图 */}
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5 text-center">
            <div className="text-sm font-black text-stone-900 mb-1">
              {pose.emoji} 模仿这个动作：{pose.name}
            </div>
            <p className="text-xs text-stone-500 mb-3">{pose.hint}</p>
            <div className="aspect-square w-full rounded-xl bg-stone-50 overflow-hidden flex items-center justify-center">
              <img
                key={pose.id}
                src={poseImageUrl(pose)}
                alt={pose.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* 摄像头 + 判定反馈 */}
          <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 p-5">
            <div className="relative aspect-square w-full rounded-xl bg-stone-900 overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // 镜像显示，像照镜子；不影响判定
              />

              {phase === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/80 text-white text-sm font-bold">
                  正在准备摄像头和 AI…
                </div>
              )}

              {phase === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900/85 text-white text-center px-4">
                  <p className="text-sm">{errMsg}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="bg-white text-stone-900 font-bold text-xs px-4 py-2 rounded-full"
                  >
                    刷新重试
                  </button>
                </div>
              )}

              {levelDone && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green-600/85 text-white text-center px-4">
                  <div className="text-5xl">🎉</div>
                  <div className="text-lg font-black">动作正确！+{SCORE_PER_POSE} 分</div>
                  <button
                    type="button"
                    onClick={nextLevel}
                    className="bg-white text-green-700 font-black px-5 py-2 rounded-full shadow-soft"
                  >
                    下一个动作 →
                  </button>
                </div>
              )}
            </div>

            {/* 相似度进度条 */}
            {phase === 'ready' && !levelDone && (
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-stone-500 mb-1">
                  <span>相似度</span>
                  <span className={hit ? 'text-green-600' : 'text-stone-500'}>{similarity}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={'h-full transition-all ' + (hit ? 'bg-green-500' : 'bg-brand-400')}
                    style={{ width: `${similarity}%` }}
                  />
                </div>
                <p className="text-center text-xs mt-2 font-bold text-stone-500">
                  {hit ? `保持住！${Math.ceil((HOLD_MS - holdMs) / 1000)}…` : '调整动作，让相似度超过 75 分'}
                </p>
                {hit && (
                  <div className="mt-1 h-1.5 rounded-full bg-green-100 overflow-hidden">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${holdPct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <GameHistoryChart records={history} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-brand-100 py-3 text-center">
      <div className="text-xs text-stone-400 font-bold">{label}</div>
      <div className="text-lg font-black text-stone-900">{value}</div>
    </div>
  )
}

export default PoseMimic
