import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import NewLesson from './pages/NewLesson'
import LessonDetail from './pages/LessonDetail'
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
      <Route element={<AppShell />}>
        {/* DTT 教案模块 */}
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewLesson />} />
        <Route path="/lessons/:id" element={<LessonDetail />} />
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
