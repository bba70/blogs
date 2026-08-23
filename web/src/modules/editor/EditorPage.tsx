import { useState, useEffect, useCallback } from 'react'
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
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)

  const isEdit = Boolean(slug)

  useEffect(() => {
    if (slug) {
      fetchPost(slug)
    }
  }, [slug, fetchPost])

  useEffect(() => {
    if (slug && currentPost?.slug === slug && loadedSlug !== slug) {
      // The post arrives asynchronously from the store and seeds an editable local draft.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormState({
        title: currentPost.title,
        postSlug: currentPost.slug,
        summary: currentPost.summary,
        content: currentPost.content,
        status: currentPost.status,
        tagNames: currentPost.tags,
        autoSlug: false,
      })
      setLoadedSlug(slug)
    } else if (!slug && loadedSlug !== null) {
      setFormState(initialState)
      setLoadedSlug(null)
    }
  }, [currentPost, loadedSlug, slug])

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
    <div className="mx-auto max-w-[1080px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-9 border-b border-line pb-7">
        <p className="text-sm font-medium text-primary">创作空间</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-ink">
          {isEdit ? '编辑文章' : '新建文章'}
        </h1>
        <p className="mt-2 text-sm text-muted">把想法整理成一篇值得长期保留的内容。</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[14px] border border-line bg-white p-5 sm:p-8">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">标题</label>
          <input
            type="text"
            value={formState.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="min-h-12 w-full rounded-[10px] border border-line bg-white px-4 text-base text-ink placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="文章标题"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">Slug</label>
            <button
              type="button"
              onClick={() => setAutoSlug(!formState.autoSlug)}
              className="text-xs text-muted hover:text-primary"
            >
              {formState.autoSlug ? '自动生成' : '手动编辑'}
            </button>
          </div>
          <input
            type="text"
            value={formState.postSlug}
            onChange={(e) => setPostSlug(e.target.value)}
            disabled={formState.autoSlug}
            className="min-h-11 w-full rounded-[10px] border border-line bg-white px-4 text-sm text-ink disabled:bg-soft focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="url-slug"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">摘要</label>
          <textarea
            value={formState.summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="w-full rounded-[10px] border border-line bg-white px-4 py-3 text-sm leading-6 text-ink placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="可选的文章摘要"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">标签</label>
          <TagSelector selectedTags={formState.tagNames} onChange={setTagNames} />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">内容</label>
          <div className="min-h-[380px] overflow-hidden rounded-[10px] border border-line bg-white focus-within:border-primary">
            {(!isEdit || loadedSlug === slug) && (
              <MilkdownEditor
                key={isEdit ? slug : 'new'}
                initialContent={formState.content}
                onChange={setContent}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <select
            value={formState.status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className="min-h-11 rounded-[10px] border border-line bg-white px-4 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>

          <button
            type="submit"
            disabled={loading || !formState.title.trim() || !formState.content.trim()}
            className="min-h-11 rounded-[10px] bg-primary px-7 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '保存中...' : isEdit ? '更新' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
