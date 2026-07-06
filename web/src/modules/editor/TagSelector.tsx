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
      onChange(selectedTags.filter((t) => t !== name))
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
          className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
            selectedTags.includes(tag.name)
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {tag.name}
        </button>
      ))}
      {tags.length === 0 && <span className="text-xs text-gray-400">暂无标签</span>}
    </div>
  )
}
