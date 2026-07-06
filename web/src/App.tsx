import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout'
import PostListPage from '@/pages/PostListPage'
import PostDetailPage from '@/pages/PostDetailPage'
import PostEditorPage from '@/pages/PostEditorPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<PostListPage />} />
        <Route path="/posts/:slug" element={<PostDetailPage />} />
        <Route path="/editor" element={<PostEditorPage />} />
        <Route path="/editor/:slug" element={<PostEditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
