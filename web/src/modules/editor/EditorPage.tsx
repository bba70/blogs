import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { usePostStore } from '@/stores'
import type { PostKind, PostStatus } from '@/types'
import AuthorAvatar from '@/components/AuthorAvatar'
import MarkdownRenderer from './MarkdownRenderer'
import MilkdownEditor, { type EditorHeading, type MilkdownEditorHandle } from './MilkdownEditor'
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
  kind: PostKind
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
  kind: 'article',
  tagNames: [],
  autoSlug: true,
}

export default function EditorPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const newKind = searchParams.get('kind') === 'essay' ? 'essay' : 'article'
  const newPostState = useMemo<FormState>(() => ({
    ...initialState,
    kind: newKind,
  }), [newKind])
  const navigate = useNavigate()
  const { currentPost, fetchPost, createPost, updatePost, loading, error } = usePostStore()
  const [formState, setFormState] = useState<FormState>(newPostState)
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [headings, setHeadings] = useState<EditorHeading[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MilkdownEditorHandle>(null)

  const isEdit = Boolean(slug)
  const isEssay = formState.kind === 'essay'
  const contentLabel = isEssay ? '随笔' : '文章'
  const listPath = isEssay ? '/essays' : '/blog'
  const characterCount = useMemo(() => countCharacters(formState.content), [formState.content])
  const outline = useMemo(() => {
    const stack: { level: number; number: number }[] = []
    return headings.map((heading, index) => {
      let number = 1
      while (stack.length && stack[stack.length - 1].level >= heading.level) {
        const previous = stack.pop()!
        if (previous.level === heading.level) number = previous.number + 1
      }
      stack.push({ level: heading.level, number })
      return { ...heading, index, depth: stack.length - 1, number: stack.map((item) => item.number).join('.') }
    })
  }, [headings])
  const awaitingPost = isEdit && loadedSlug !== slug
  const statusText = awaitingPost
    ? error ? '加载失败' : '正在加载…'
    : loading ? '正在保存…' : formState.status === 'published' ? '已发布' : '草稿'
  const canSave = Boolean(formState.title.trim() && formState.content.trim() && !loading && !coverUploading && (!isEdit || loadedSlug === slug))

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
        kind: currentPost.kind,
        tagNames: currentPost.tags,
        autoSlug: false,
      })
      setLoadedSlug(slug)
    } else if (!slug && loadedSlug !== null) {
      setFormState(newPostState)
      setLoadedSlug(null)
    }
  }, [currentPost, loadedSlug, newPostState, slug])

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
      content: editorRef.current?.getMarkdown() ?? formState.content,
      status,
      kind: formState.kind,
      tags: formState.tagNames,
    }

    if (isEdit && slug) {
      const saved = await updatePost(slug, payload)
      if (saved) navigate(`/posts/${encodeURIComponent(payload.slug)}`)
      return
    }

    const createdSlug = await createPost(payload)
    if (createdSlug) navigate(`/posts/${encodeURIComponent(createdSlug)}`)
  }

  function selectKind(kind: PostKind) {
    setFormState((previous) => ({
      ...previous,
      kind,
    }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void savePost(formState.status)
  }

  function togglePreview() {
    const content = editorRef.current?.getMarkdown()
    if (content !== undefined) setContent(content)
    setPreviewOpen((open) => !open)
  }

  function focusHeading(index: number) {
    const heading = contentRef.current?.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')[index]
    if (!heading) return
    heading.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="editor-workspace">
      <div className="editor-commandbar">
        <div className="editor-commandbar__inner">
          <div className="editor-commandbar__identity">
            <Link to={listPath} aria-label={`返回${contentLabel}列表`}>←</Link>
            <div>
              <strong>创作台</strong>
              <span>{isEdit ? '编辑' : '新建'}{contentLabel}</span>
            </div>
          </div>
          <div className="editor-commandbar__status" role="status" aria-label="发布状态">
            {!awaitingPost && <span className={`editor-status-dot editor-status-dot--${formState.status}`} aria-hidden="true" />}
            <span>{statusText}</span>
            {!awaitingPost && !loading && <span className="editor-commandbar__visibility">{formState.status === 'published' ? '公开可见' : '未公开'}</span>}
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
              <AuthorAvatar className="editor-outline__avatar" editable={false} />
              <div><strong>bba70</strong><span>个人博客</span></div>
            </div>
            {(!isEdit || loadedSlug === slug) && <CoverUploader
              key={slug ?? 'new'}
              value={formState.coverURL}
              onChange={(coverURL) => setFormState((previous) => ({ ...previous, coverURL }))}
              onBusyChange={setCoverUploading}
            />}
            <nav className="editor-outline__nav" aria-label="正文目录">
              <div className="editor-outline__label"><strong>文章目录</strong><span>自动识别标题</span></div>
              {(!isEdit || loadedSlug === slug) && <div className="editor-outline__article">
                <strong>{formState.title.trim() || '未命名文章'}</strong>
              </div>}
              {isEdit && loadedSlug !== slug ? (
                <p className="editor-outline__empty">{error ? '文章加载失败，暂时无法生成目录。' : '正在读取文章结构…'}</p>
              ) : outline.length ? (
                <ol className="editor-outline__list">
                  {outline.map((heading) => (
                    <li key={heading.index}>
                      <button type="button" style={{ paddingLeft: `${12 + heading.depth * 12}px` }} onClick={() => focusHeading(heading.index)}>
                        <span className="editor-outline__number">{heading.number}</span>
                        <span className="editor-outline__text">{heading.text.trim() || '未命名章节'}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="editor-outline__empty">为正文添加标题，即可自动生成层级目录。可使用工具栏的标题格式，或输入 #、##、### 后按空格。</p>
              )}
            </nav>
          </section>
          {isEdit ? (
            <Link className="editor-outline__new" to={isEssay ? '/editor?kind=essay' : '/editor'}><span aria-hidden="true">＋</span> 新建{contentLabel}</Link>
          ) : (
            <p className="editor-outline__hint">目录会随正文标题更新，点击章节可定位内容。</p>
          )}
        </aside>

        <main className="editor-paper">
          <div className="editor-paper__heading">
            <label className="sr-only" htmlFor="editor-title">文章标题</label>
            <div className="editor-title-row">
              <input
                id="editor-title"
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
              placeholder={isEssay ? '为这段记录留一句简短说明（可选）' : '写一段简短摘要，帮助读者了解文章内容（可选）'}
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
                  editorRef={editorRef}
                  key={isEdit ? slug : 'new'}
                  initialContent={formState.content}
                  onChange={setContent}
                  onHeadingsChange={setHeadings}
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
              <button type="button" className="editor-button editor-button--outline" onClick={togglePreview}>
                {previewOpen ? '继续编辑' : '预览'}
              </button>
              <button type="button" className="editor-button editor-button--primary" onClick={() => void savePost('published')} disabled={!canSave}>
                {formState.status === 'published' ? '更新发布' : '发布'}
              </button>
            </div>
          </footer>
        </main>

        <aside className="editor-settings" aria-label="文章设置">
          <details open className="editor-settings__panel">
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
                <TagSelector key={slug ?? newKind} selectedTags={formState.tagNames} onChange={setTagNames} disabled={loading || awaitingPost} />
              </div>

              <div className="editor-setting-field">
                <span className="editor-setting-field__title">内容类型</span>
                <div className="editor-setting-choices">
                  <button
                    type="button"
                    aria-pressed={formState.kind === 'article'}
                    onClick={() => selectKind('article')}
                  >
                    文章
                  </button>
                  <button
                    type="button"
                    aria-pressed={formState.kind === 'essay'}
                    onClick={() => selectKind('essay')}
                  >
                    随笔
                  </button>
                </div>
              </div>

            </div>
          </details>

          <section className="editor-settings__tip">
            <span aria-hidden="true">✦</span>
            <div><strong>写作提示</strong><p>{isEssay ? '不必急着得出结论，先把此刻的想法记下来。' : '清晰的标题和摘要，能让文章更容易被理解。'}</p></div>
          </section>
        </aside>
      </form>
    </div>
  )
}
