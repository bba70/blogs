import { useRef, useEffect } from 'react'
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/classic.css'
import './MilkdownEditor.css'

interface MilkdownEditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
}

function MilkdownInner({ initialContent, onChange }: MilkdownEditorProps) {
  const onChangeRef = useRef(onChange)
  const initialContentRef = useRef(initialContent ?? '')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: initialContentRef.current,
      features: {
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.Toolbar]: false,
      },
    })
    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })
    return crepe
  }, [])

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
