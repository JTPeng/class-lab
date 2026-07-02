import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import NewLesson from './pages/NewLesson'
import LessonDetail from './pages/LessonDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewLesson />} />
      <Route path="/lessons/:id" element={<LessonDetail />} />
    </Routes>
  )
}

export default App
