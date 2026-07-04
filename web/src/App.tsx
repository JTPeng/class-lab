import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import NewLesson from './pages/NewLesson'
import LessonDetail from './pages/LessonDetail'
import GuardianView from './pages/GuardianView'
import PictureBook from './pages/PictureBook'
import Games from './pages/Games'
import AnimalSound from './pages/AnimalSound'
import ShapeMatch from './pages/ShapeMatch'
import ShadowMatch from './pages/ShadowMatch'
import MemoryFlip from './pages/MemoryFlip'
import PoseMimic from './pages/PoseMimic'
import VideoAnalysis from './pages/VideoAnalysis'
import VideoAnalysisDetail from './pages/VideoAnalysisDetail'
import TrainingTopics from './pages/TrainingTopics'
import TrainingTopicDetail from './pages/TrainingTopicDetail'
import TrainingQuiz from './pages/TrainingQuiz'

function App() {
  return (
    <Routes>
      {/* 家长/督导免登录只读分享页，不受 AppShell 登录门禁约束 */}
      <Route path="/share/:shareToken" element={<GuardianView />} />
      <Route element={<AppShell />}>
        {/* DTT 教案模块：个案建档 → 教案 → 执行记录闭环 */}
        <Route path="/" element={<Cases />} />
        <Route path="/cases/:caseId" element={<CaseDetail />} />
        <Route path="/cases/:caseId/new" element={<NewLesson />} />
        <Route path="/cases/:caseId/lessons/:id" element={<LessonDetail />} />
        {/* 绘本打卡模块 */}
        <Route path="/picture-book" element={<PictureBook />} />
        {/* 游戏乐园模块 */}
        <Route path="/games" element={<Games />} />
        <Route path="/games/animal-sound" element={<AnimalSound />} />
        <Route path="/games/shape-match" element={<ShapeMatch />} />
        <Route path="/games/shadow-match" element={<ShadowMatch />} />
        <Route path="/games/memory-flip" element={<MemoryFlip />} />
        <Route path="/games/pose-mimic" element={<PoseMimic />} />
        {/* 视频分析模块 */}
        <Route path="/video" element={<VideoAnalysis />} />
        <Route path="/video/:id" element={<VideoAnalysisDetail />} />
        {/* 培训测评模块 */}
        <Route path="/training" element={<TrainingTopics />} />
        <Route path="/training/:id" element={<TrainingTopicDetail />} />
        <Route path="/training/:id/quiz" element={<TrainingQuiz />} />
      </Route>
    </Routes>
  )
}

export default App
