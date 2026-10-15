import { Navigate, Routes, Route, useLocation } from 'react-router'
import Layout from '@/components/Layout'
import PostListPage from '@/pages/PostListPage'
import BlogPage from '@/pages/BlogPage'
import EssayPage from '@/pages/EssayPage'
import ArchivePage from '@/pages/ArchivePage'
import PostDetailPage from '@/pages/PostDetailPage'
import PostEditorPage from '@/pages/PostEditorPage'
import NotFoundPage from '@/pages/NotFoundPage'
import LoginPage from '@/pages/LoginPage'
import TopicsPage from '@/pages/TopicsPage'
import ProtectedRoute from '@/components/ProtectedRoute'

function HomeRoute() {
  const location = useLocation()
  if (location.hash === '#topics') return <Navigate to={`/topics${location.search}`} replace />
  return <PostListPage />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/essays" element={<ProtectedRoute><EssayPage /></ProtectedRoute>} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/posts/:slug" element={<PostDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/editor" element={<ProtectedRoute><PostEditorPage /></ProtectedRoute>} />
        <Route path="/editor/:slug" element={<ProtectedRoute><PostEditorPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
