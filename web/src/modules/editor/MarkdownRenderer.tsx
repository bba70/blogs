import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose prose-gray max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  )
}
