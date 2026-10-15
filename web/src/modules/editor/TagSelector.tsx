import { useEffect, useId, useRef, useState } from 'react'
import { Ellipsis, Plus, X } from 'lucide-react'
import './TagSelector.css'

interface TagSelectorProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}

interface TagDraft {
  original: string | null
  value: string
}

export default function TagSelector({ selectedTags, onChange, disabled = false }: TagSelectorProps) {
  const [draft, setDraft] = useState<TagDraft | null>(null)
  const [error, setError] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<TagDraft | null>(null)
  const selectedRef = useRef(selectedTags)
  const createRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const original = draft?.original
  const hasDraft = draft !== null

  useEffect(() => { selectedRef.current = selectedTags }, [selectedTags])
  useEffect(() => {
    if (hasDraft) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [hasDraft, original, panelOpen])

  function changeDraft(next: TagDraft | null) {
    draftRef.current = next
    setDraft(next)
    setError('')
  }

  function cancelDraft(restoreFocus = false) {
    changeDraft(null)
    if (restoreFocus) requestAnimationFrame(() => (panelOpen ? closeRef : createRef).current?.focus())
  }

  function finishDraft(restoreFocus = false) {
    const current = draftRef.current
    if (disabled || !current) return
    const name = current.value.trim()
    if (!name) { cancelDraft(restoreFocus); return }
    if (Array.from(name).length > 100 || Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      setError('标签名称最多 100 个字符，且不能包含控制字符。')
      return
    }
    if (selectedRef.current.some((tag) => tag === name && tag !== current.original)) {
      setError('当前内容已包含这个标签。')
      return
    }
    const next = current.original === null
      ? [...selectedRef.current, name]
      : selectedRef.current.map((tag) => tag === current.original ? name : tag)
    selectedRef.current = next
    onChange(next)
    cancelDraft(restoreFocus)
  }

  function startRename(name: string) {
    if (!disabled) changeDraft({ original: name, value: name })
  }

  function removeTag(name: string) {
    if (disabled) return
    const next = selectedRef.current.filter((tag) => tag !== name)
    selectedRef.current = next
    onChange(next)
    if (draftRef.current?.original === name) cancelDraft()
    requestAnimationFrame(() => (panelOpen ? closeRef : createRef).current?.focus())
  }

  function renderInput(key?: string) {
    if (!draft) return null
    return <input key={key} ref={inputRef} className="tag-chip tag-chip--input"
      aria-label={draft.original === null ? '新标签名称' : '重命名标签 ' + draft.original}
      aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined}
      value={draft.value} disabled={disabled} placeholder="标签名称"
      style={{ width: `${Math.max(10, Array.from(draft.value).reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 2 : 1), 0) + 4)}ch` }}
      onChange={(event) => changeDraft({ ...draft, value: event.target.value })}
      onBlur={() => finishDraft()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); finishDraft(true) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelDraft(true) }
      }} />
  }

  return <div className="tag-selector">
    <div className="tag-selector__heading">
      <span className="editor-setting-field__title">标签</span>
      <button ref={moreRef} type="button" className="tag-selector__more" aria-label="整理当前内容的标签"
        popoverTarget={id + '-panel'} disabled={disabled || selectedTags.length === 0}>
        <Ellipsis size={18} aria-hidden="true" />
      </button>
    </div>
    <div className="tag-selector__chips" role="group" aria-label="当前内容的标签">
      {selectedTags.map((name) => draft?.original === name && !panelOpen ? renderInput(name) : <div className="tag-bubble" key={name}>
        <button type="button" className="tag-chip tag-chip--attached" disabled={disabled} aria-label={'标签 ' + name + '，双击或按 F2 改名'}
          title="双击改名；键盘按 Enter 或 F2 改名" onDoubleClick={() => startRename(name)}
          onClick={(event) => { if (event.detail === 0) startRename(name) }}
          onKeyDown={(event) => { if (event.key === 'F2') { event.preventDefault(); startRename(name) } }}><span>{name}</span></button>
        <button type="button" className="tag-bubble__remove" aria-label={'从当前内容移除标签 ' + name} disabled={disabled}
          onClick={() => removeTag(name)}><X size={12} aria-hidden="true" /></button>
      </div>)}
      {draft?.original === null && renderInput()}
      <button ref={createRef} type="button" className="tag-chip tag-chip--add" aria-label="新增标签" title="新增标签" disabled={disabled || hasDraft}
        onClick={() => changeDraft({ original: null, value: '' })}><Plus size={16} aria-hidden="true" /></button>
    </div>
    {!panelOpen && error && <p id={id + '-error'} className="tag-selector__error" role="alert">{error}</p>}
    <div ref={panelRef} id={id + '-panel'} popover="auto" role="dialog" aria-labelledby={id + '-panel-title'} className="tag-manager"
      onToggle={(event) => {
        const open = event.newState === 'open'
        setPanelOpen(open)
        if (open) closeRef.current?.focus()
        else cancelDraft()
      }}>
      <div className="tag-manager__heading">
        <h3 id={id + '-panel-title'}>整理当前标签</h3>
        <button ref={closeRef} type="button" className="tag-selector__more" aria-label="关闭标签整理" disabled={disabled}
          onClick={() => { panelRef.current?.hidePopover(); moreRef.current?.focus() }}><X size={18} aria-hidden="true" /></button>
      </div>
      <p className="tag-selector__note">仅影响当前内容，随文章或随笔一起保存。</p>
      <div className="tag-manager__list">
        {selectedTags.map((name) => <div className="tag-manager__item" key={name}>
          {panelOpen && draft?.original === name ? renderInput() : <div className="tag-manager__row">
            <span className="tag-manager__name">{name}</span>
            <div className="tag-manager__row-actions">
              <button type="button" aria-label={'改名标签 ' + name} disabled={disabled} onClick={() => startRename(name)}>改名</button>
              <button type="button" aria-label={'从当前内容移除标签 ' + name} disabled={disabled} onClick={() => removeTag(name)}>移除</button>
            </div>
          </div>}
        </div>)}
        {selectedTags.length === 0 && <p className="tag-selector__note">当前内容没有标签。</p>}
      </div>
      {panelOpen && error && <p id={id + '-error'} className="tag-selector__error" role="alert">{error}</p>}
    </div>
  </div>
}
