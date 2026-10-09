import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import PostListPage from '@/pages/PostListPage'
import BlogPage from '@/pages/BlogPage'
import ArchivePage from '@/pages/ArchivePage'
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
        <Route path="/blog" element={<BlogPage />} />
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
