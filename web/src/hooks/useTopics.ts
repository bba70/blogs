import { useEffect, useState } from 'react'
import { isApiError } from '@/api/client'
import { fetchTopicPosts, fetchTopicTags } from '@/api/topics'
import { useAuthStore } from '@/stores'
import type { Post, Tag } from '@/types'

function handleError(error: unknown, signal: AbortSignal) {
  if (signal.aborted) return
  if (isApiError(error) && error.status === 401) useAuthStore.getState().expireSession()
}

// Consumers remount by identity/tag so an old response never appears in a new scope.
export function useTopicTags(isOwner: boolean) {
  const [state, setState] = useState<{ tags: Tag[]; loading: boolean; error: boolean }>({ tags: [], loading: true, error: false })
  useEffect(() => {
    const controller = new AbortController()
    fetchTopicTags(isOwner, controller.signal)
      .then((tags) => { if (!controller.signal.aborted) setState({ tags, loading: false, error: false }) })
      .catch((error: unknown) => {
        handleError(error, controller.signal)
        if (!controller.signal.aborted) setState({ tags: [], loading: false, error: true })
      })
    return () => controller.abort()
  }, [isOwner])
  return state
}

export function useTopicPosts(tag: string, isOwner: boolean) {
  const [state, setState] = useState<{ articles: Post[]; essays: Post[]; loading: boolean; error: boolean }>({ articles: [], essays: [], loading: true, error: false })
  useEffect(() => {
    const controller = new AbortController()
    fetchTopicPosts(tag, isOwner, controller.signal)
      .then((posts) => { if (!controller.signal.aborted) setState({ ...posts, loading: false, error: false }) })
      .catch((error: unknown) => {
        handleError(error, controller.signal)
        if (!controller.signal.aborted) setState({ articles: [], essays: [], loading: false, error: true })
      })
    return () => controller.abort()
  }, [tag, isOwner])
  return state
}
