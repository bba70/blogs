import { useEffect } from 'react'
import { useTagStore } from '@/stores'

interface TagSelectorProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
}

export default function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const { tags, fetchTags } = useTagStore()

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  function toggle(name: string) {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter((tag) => tag !== name))
    } else {
      onChange([...selectedTags, name])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggle(tag.name)}
          className={`min-h-8 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            selectedTags.includes(tag.name)
              ? 'border-primary bg-primary text-white'
              : 'border-line bg-white text-muted hover:border-primary hover:text-primary'
          }`}
        >
          {tag.name}
        </button>
      ))}
      {tags.length === 0 && <span className="text-xs text-muted">暂无标签</span>}
    </div>
  )
}
