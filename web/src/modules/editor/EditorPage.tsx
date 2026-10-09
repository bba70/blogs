import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePostStore } from '@/stores'
import type { PostStatus } from '@/types'
import MarkdownRenderer from './MarkdownRenderer'
import MilkdownEditor from './MilkdownEditor'
import TagSelector from './TagSelector'
import CoverUploader from './CoverUploader'
import './EditorPage.css'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9一-鿿-]/g, '')
    .slice(0, 100)
}

function countCharacters(content: string) {
  return content.replace(/\s/g, '').length
}

interface FormState {
  title: string
  postSlug: string
  summary: string
  coverURL: string
  content: string
  status: PostStatus
  tagNames: string[]
  autoSlug: boolean
}

const initialState: FormState = {
  title: '',
  postSlug: '',
  summary: '',
  coverURL: '',
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDetailsElement>(null)

  const isEdit = Boolean(slug)
  const characterCount = useMemo(() => countCharacters(formState.content), [formState.content])
  const canSave = Boolean(formState.title.trim() && formState.content.trim() && !loading && !coverUploading)

  useEffect(() => {
    if (slug) fetchPost(slug)
  }, [slug, fetchPost])

  useEffect(() => {
    if (slug && currentPost?.slug === slug && loadedSlug !== slug) {
      // The post arrives asynchronously from the store and seeds an editable local draft.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormState({
        title: currentPost.title,
        postSlug: currentPost.slug,
        summary: currentPost.summary,
        coverURL: currentPost.cover_url ?? '',
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

  const setTitle = useCallback((title: string) => {
    setFormState((previous) => ({ ...previous, title }))
  }, [])

  const setPostSlug = useCallback((postSlug: string) => {
    setFormState((previous) => ({ ...previous, postSlug }))
  }, [])

  const setSummary = useCallback((summary: string) => {
    setFormState((previous) => ({ ...previous, summary }))
  }, [])

  const setContent = useCallback((content: string) => {
    setFormState((previous) => ({ ...previous, content }))
  }, [])

  const setTagNames = useCallback((tagNames: string[]) => {
    setFormState((previous) => ({ ...previous, tagNames }))
  }, [])

  function handleTitleChange(title: string) {
    setTitle(title)
    if (formState.autoSlug) setPostSlug(generateSlug(title))
  }

  async function savePost(status: PostStatus) {
    if (!canSave) return

    const payload = {
      title: formState.title.trim(),
      slug: formState.postSlug,
      summary: formState.summary.trim(),
      cover_url: formState.coverURL,
      content: formState.content,
      status,
      tags: formState.tagNames,
    }

    setFormState((previous) => ({ ...previous, status }))

    if (isEdit && slug) {
      const saved = await updatePost(slug, payload)
      if (saved) navigate(`/posts/${payload.slug}`)
      return
    }

    const createdSlug = await createPost(payload)
    if (createdSlug) navigate(`/posts/${createdSlug}`)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void savePost(formState.status)
  }

  function focusSection(section: 'title' | 'content' | 'settings') {
    if (section === 'title') {
      titleRef.current?.focus()
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (section === 'content') {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (settingsRef.current) {
      settingsRef.current.open = true
      settingsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="editor-workspace">
      <div className="editor-commandbar">
        <div className="editor-commandbar__inner">
          <div className="editor-commandbar__identity">
            <Link to="/blog" aria-label="返回文章列表">←</Link>
            <div>
              <strong>创作台</strong>
              <span>{isEdit ? '编辑文章' : '新建文章'}</span>
            </div>
          </div>
          <div className="editor-commandbar__status" aria-live="polite">
            <span className={`editor-status-dot editor-status-dot--${formState.status}`} />
            {loading ? '正在保存…' : formState.status === 'published' ? '已发布内容' : '草稿内容'}
          </div>
          <div className="editor-commandbar__tools" aria-label="写作提示">
            <span>支持 Markdown</span>
            <span>{characterCount} 字</span>
          </div>
        </div>
      </div>

      {error && <div className="editor-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="editor-workspace__layout">
        <aside className="editor-outline" aria-label="文章结构">
          <section className="editor-outline__card">
            <div className="editor-outline__author">
              <span className="editor-outline__avatar" aria-hidden="true">逃</span>
              <div><strong>bba70</strong><span>个人博客</span></div>
            </div>
            {(!isEdit || loadedSlug === slug) && <CoverUploader
              key={slug ?? 'new'}
              value={formState.coverURL}
              title={formState.title}
              status={formState.status}
              onChange={(coverURL) => setFormState((previous) => ({ ...previous, coverURL }))}
              onBusyChange={setCoverUploading}
            />}
            <nav className="editor-outline__nav" aria-label="快速定位">
              <button type="button" onClick={() => focusSection('title')}><span>01</span>标题</button>
              <button type="button" onClick={() => focusSection('content')}><span>02</span>正文</button>
              <button type="button" onClick={() => focusSection('settings')}><span>03</span>文章设置</button>
            </nav>
          </section>
          {isEdit ? (
            <Link className="editor-outline__new" to="/editor"><span aria-hidden="true">＋</span> 新建文章</Link>
          ) : (
            <p className="editor-outline__hint">先写下标题，再开始整理正文。</p>
          )}
        </aside>

        <main className="editor-paper">
          <div className="editor-paper__heading">
            <label className="sr-only" htmlFor="editor-title">文章标题</label>
            <div className="editor-title-row">
              <input
                id="editor-title"
                ref={titleRef}
                type="text"
                value={formState.title}
                maxLength={80}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="请在这里输入标题"
              />
              <span>{formState.title.length}/80</span>
            </div>
            <label className="sr-only" htmlFor="editor-summary">文章摘要</label>
            <textarea
              id="editor-summary"
              value={formState.summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={2}
              maxLength={180}
              placeholder="写一段简短摘要，帮助读者了解文章内容（可选）"
            />
          </div>

          <div ref={contentRef} className="editor-paper__body">
            {previewOpen ? (
              <section className="editor-preview" aria-label="文章预览">
                <p className="editor-preview__label">阅读预览</p>
                {formState.content.trim() ? (
                  <MarkdownRenderer content={formState.content} />
                ) : (
                  <p className="editor-preview__empty">正文内容会在这里呈现。</p>
                )}
              </section>
            ) : (
              (!isEdit || loadedSlug === slug) && (
                <MilkdownEditor
                  key={isEdit ? slug : 'new'}
                  initialContent={formState.content}
                  onChange={setContent}
                />
              )
            )}
          </div>

          <footer className="editor-paper__footer">
            <div><strong>正文 {characterCount} 字</strong><span>内容会以 Markdown 保存</span></div>
            <div className="editor-paper__actions">
              <button type="button" className="editor-button editor-button--quiet" onClick={() => void savePost('draft')} disabled={!canSave}>
                {loading ? '保存中…' : '保存草稿'}
              </button>
              <button type="button" className="editor-button editor-button--outline" onClick={() => setPreviewOpen((open) => !open)}>
                {previewOpen ? '继续编辑' : '预览'}
              </button>
              <button type="button" className="editor-button editor-button--primary" onClick={() => void savePost('published')} disabled={!canSave}>
                {formState.status === 'published' ? '更新发布' : '发布'}
              </button>
            </div>
          </footer>
        </main>

        <aside className="editor-settings" aria-label="文章设置">
          <details ref={settingsRef} open className="editor-settings__panel">
            <summary><span>文章设置</span><span aria-hidden="true">⌄</span></summary>
            <div className="editor-settings__content">
              <div className="editor-setting-field">
                <div className="editor-setting-field__label">
                  <label htmlFor="editor-slug">访问地址</label>
                  <button
                    type="button"
                    onClick={() => setFormState((previous) => ({ ...previous, autoSlug: !previous.autoSlug }))}
                  >
                    {formState.autoSlug ? '自动生成' : '手动编辑'}
                  </button>
                </div>
                <div className="editor-slug-input">
                  <span>/posts/</span>
                  <input
                    id="editor-slug"
                    type="text"
                    value={formState.postSlug}
                    onChange={(event) => setPostSlug(event.target.value)}
                    disabled={formState.autoSlug}
                    placeholder="article-slug"
                  />
                </div>
              </div>

              <div className="editor-setting-field">
                <span className="editor-setting-field__title">标签</span>
                <TagSelector selectedTags={formState.tagNames} onChange={setTagNames} />
              </div>

              <div className="editor-setting-field">
                <span className="editor-setting-field__title">发布状态</span>
                <div className="editor-setting-status">
                  <span className={`editor-status-dot editor-status-dot--${formState.status}`} />
                  <div>
                    <strong>{formState.status === 'published' ? '已发布' : '草稿'}</strong>
                    <span>{formState.status === 'published' ? '读者可以访问这篇文章' : '仅保存在创作空间中'}</span>
                  </div>
                </div>
              </div>
            </div>
          </details>

          <section className="editor-settings__tip">
            <span aria-hidden="true">✦</span>
            <div><strong>写作提示</strong><p>清晰的标题和摘要，能让文章更容易被理解。</p></div>
          </section>
        </aside>
      </form>
    </div>
  )
}
