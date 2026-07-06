import { lazy, Suspense } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'

const EditorPage = lazy(() => import('@/modules/editor/EditorPage'))

export default function PostEditorPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <EditorPage />
    </Suspense>
  )
}
