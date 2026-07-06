import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePostStore } from '@/stores'
import type { PostStatus } from '@/types'
import MilkdownEditor from './MilkdownEditor'
import TagSelector from './TagSelector'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9一-鿿-]/g, '')
    .slice(0, 100)
}

interface FormState {
  title: string
  postSlug: string
  summary: string
  content: string
  status: PostStatus
  tagNames: string[]
  autoSlug: boolean
}

const initialState: FormState = {
  title: '',
  postSlug: '',
  summary: '',
  content: '',
  status: 'draft',
  tagNames: [],
  autoSlug: true,
}

export default function EditorPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { currentPost, fetchPost, createPost, updatePost, loading, error } = usePostStore()

  const [formState, setFormState] = useState<FormState>(initialState)
  const initializedRef = useRef(false)

  const isEdit = Boolean(slug)

  useEffect(() => {
    if (slug) {
      fetchPost(slug)
    }
  }, [slug, fetchPost])

  useEffect(() => {
    if (isEdit && currentPost && slug && !initializedRef.current) {
      initializedRef.current = true
      setFormState({
        title: currentPost.title,
        postSlug: currentPost.slug,
        summary: currentPost.summary,
        content: currentPost.content,
        status: currentPost.status,
        tagNames: currentPost.tags,
        autoSlug: false,
      })
    } else if (!isEdit && !initializedRef.current) {
      initializedRef.current = true
      setFormState(initialState)
    }
  }, [isEdit, currentPost, slug])

  // Reset initialized flag when switching between create/edit modes
  useEffect(() => {
    initializedRef.current = false
  }, [isEdit])

  const setTitle = useCallback((newTitle: string) => {
    setFormState((prev) => ({ ...prev, title: newTitle }))
  }, [])

  const setPostSlug = useCallback((newSlug: string) => {
    setFormState((prev) => ({ ...prev, postSlug: newSlug }))
  }, [])

  const setSummary = useCallback((newSummary: string) => {
    setFormState((prev) => ({ ...prev, summary: newSummary }))
  }, [])

  const setContent = useCallback((newContent: string) => {
    setFormState((prev) => ({ ...prev, content: newContent }))
  }, [])

  const setStatus = useCallback((newStatus: PostStatus) => {
    setFormState((prev) => ({ ...prev, status: newStatus }))
  }, [])

  const setTagNames = useCallback((newTagNames: string[]) => {
    setFormState((prev) => ({ ...prev, tagNames: newTagNames }))
  }, [])

  const setAutoSlug = useCallback((value: boolean) => {
    setFormState((prev) => ({ ...prev, autoSlug: value }))
  }, [])

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      if (formState.autoSlug) {
        setPostSlug(generateSlug(newTitle))
      }
    },
    [formState.autoSlug, setTitle, setPostSlug],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formState.title.trim() || !formState.content.trim()) return

    if (isEdit && slug) {
      const ok = await updatePost(slug, {
        title: formState.title,
        slug: formState.postSlug,
        summary: formState.summary,
        content: formState.content,
        status: formState.status,
        tags: formState.tagNames,
      })
      if (ok) navigate(`/posts/${formState.postSlug}`)
    } else {
      const result = await createPost({
        title: formState.title,
        slug: formState.postSlug,
        summary: formState.summary,
        content: formState.content,
        status: formState.status,
        tags: formState.tagNames,
      })
      if (result) navigate(`/posts/${result}`)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isEdit ? '编辑文章' : '写文章'}
      </h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">标题</label>
          <input
            type="text"
            value={formState.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="文章标题"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Slug</label>
            <button
              type="button"
              onClick={() => setAutoSlug(!formState.autoSlug)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {formState.autoSlug ? '自动生成' : '手动编辑'}
            </button>
          </div>
          <input
            type="text"
            value={formState.postSlug}
            onChange={(e) => setPostSlug(e.target.value)}
            disabled={formState.autoSlug}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="url-slug"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">摘要</label>
          <textarea
            value={formState.summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="可选的文章摘要"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">标签</label>
          <TagSelector selectedTags={formState.tagNames} onChange={setTagNames} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">内容</label>
          <div className="min-h-[300px] rounded-md border border-gray-300">
            <MilkdownEditor initialContent={formState.content} onChange={setContent} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={formState.status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>

          <button
            type="submit"
            disabled={loading || !formState.title.trim() || !formState.content.trim()}
            className="rounded-md bg-primary px-6 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? '保存中...' : isEdit ? '更新' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
