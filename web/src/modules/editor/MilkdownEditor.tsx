import { useRef, useEffect, useImperativeHandle, type Ref } from 'react'
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { getMarkdown } from '@milkdown/kit/utils'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/classic.css'
import './MilkdownEditor.css'

const toolbarLabels: Record<string, string> = {
  bold: '加粗',
  italic: '斜体',
  strikethrough: '删除线',
  code: '行内代码',
  'bullet-list': '无序列表',
  'ordered-list': '有序列表',
  'task-list': '任务列表',
  link: '插入链接',
  image: '插入图片',
  table: '插入表格',
  'code-block': '代码块',
  math: '数学公式',
  quote: '引用',
  hr: '分隔线',
}

export interface EditorHeading {
  text: string
  level: number
}

function collectHeadings(doc: Node): EditorHeading[] {
  const headings: EditorHeading[] = []
  doc.descendants((node) => {
    if (node.type.name === 'heading') {
      headings.push({ text: node.textContent, level: Number(node.attrs.level) })
    }
  })
  return headings
}

export interface MilkdownEditorHandle {
  getMarkdown: () => string | undefined
}

interface MilkdownEditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
  editorRef?: Ref<MilkdownEditorHandle>
  onHeadingsChange?: (headings: EditorHeading[]) => void
}

function MilkdownInner({ initialContent, onChange, editorRef, onHeadingsChange }: MilkdownEditorProps) {
  const onChangeRef = useRef(onChange)
  const onHeadingsChangeRef = useRef(onHeadingsChange)
  const initialContentRef = useRef(initialContent ?? '')

  useEffect(() => {
    onChangeRef.current = onChange
    onHeadingsChangeRef.current = onHeadingsChange
  }, [onChange, onHeadingsChange])

  const { get } = useEditor((root) => {
    let buttonLabels: string[] = []
    const crepe = new Crepe({
      root,
      defaultValue: initialContentRef.current,
      features: {
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.Toolbar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: '从这里开始写正文…',
          mode: 'block',
        },
        [Crepe.Feature.TopBar]: {
          buildTopBar: (builder) => {
            buttonLabels = builder.build().flatMap((group) => group.items
              .filter((item) => !item.selector && item.onRun)
              .map((item) => toolbarLabels[item.key] ?? item.key))
          },
          headingOptions: [
            { label: '正文', level: null },
            { label: '标题 1', level: 1 },
            { label: '标题 2', level: 2 },
            { label: '标题 3', level: 3 },
          ],
        },
      },
    })
    crepe.on((api) => {
      api.mounted((ctx) => {
        // Crepe's top bar has no label API; name the buttons in its built order.
        root.querySelectorAll<HTMLButtonElement>('.top-bar-item').forEach((button, index) => {
          const label = buttonLabels[index]
          if (!label) return
          button.title = label
          button.setAttribute('aria-label', label)
        })
        const headingButton = root.querySelector<HTMLButtonElement>('.top-bar-heading-button')
        if (headingButton) {
          headingButton.title = '正文与标题样式'
          headingButton.setAttribute('aria-label', '正文与标题样式')
        }
        onHeadingsChangeRef.current?.(collectHeadings(ctx.get(editorViewCtx).state.doc))
      })
      api.updated((_ctx, doc) => {
        onHeadingsChangeRef.current?.(collectHeadings(doc))
      })
      api.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })
    return crepe
  }, [])

  // The change listener is debounced; saving/previewing must read the current document.
  useImperativeHandle(editorRef, () => ({ getMarkdown: () => get()?.action(getMarkdown()) }), [get])

  return <Milkdown />
}

export default function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <div className="blog-editor">
        <MilkdownInner {...props} />
      </div>
    </MilkdownProvider>
  )
}
