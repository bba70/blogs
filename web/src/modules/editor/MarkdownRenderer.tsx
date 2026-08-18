import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-a:text-primary prose-blockquote:border-primary prose-code:text-primary prose-img:rounded-[14px]">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  )
}
