import { Component, lazy, Suspense, type ReactNode } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'

const EditorPage = lazy(() => import('@/modules/editor/EditorPage'))

class EditorErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <ErrorMessage
          message="编辑器加载失败，请刷新页面重试。"
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

export default function PostEditorPage() {
  return (
    <EditorErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <EditorPage />
      </Suspense>
    </EditorErrorBoundary>
  )
}
