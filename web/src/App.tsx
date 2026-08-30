import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import PostListPage from '@/pages/PostListPage'
import PostDetailPage from '@/pages/PostDetailPage'
import PostEditorPage from '@/pages/PostEditorPage'
import NotFoundPage from '@/pages/NotFoundPage'
import LoginPage from '@/pages/LoginPage'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<PostListPage />} />
        <Route path="/posts/:slug" element={<PostDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/editor" element={<ProtectedRoute><PostEditorPage /></ProtectedRoute>} />
        <Route path="/editor/:slug" element={<ProtectedRoute><PostEditorPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
