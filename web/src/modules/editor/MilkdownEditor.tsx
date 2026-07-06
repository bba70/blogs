import { useRef, useEffect } from 'react'
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/classic.css'

interface MilkdownEditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
}

function MilkdownInner({ initialContent, onChange }: MilkdownEditorProps) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: initialContent ?? '',
    })
    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current?.(markdown)
      })
    })
    return crepe
  }, [initialContent])

  return <Milkdown />
}

export default function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MilkdownInner {...props} />
    </MilkdownProvider>
  )
}
