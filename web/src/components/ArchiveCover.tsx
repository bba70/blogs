import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ImageNode {
  type: string
  tagName?: string
  children?: ImageNode[]
}

// Select from parsed Markdown so code examples, escaped syntax and reference
// images behave the same way as the article renderer.
function firstImageOnly() {
  return (tree: { children: ImageNode[] }) => {
    function findImage(node: ImageNode): ImageNode | undefined {
      if (node.type === 'element' && node.tagName === 'img') return node
      for (const child of node.children ?? []) {
        const image = findImage(child)
        if (image) return image
      }
    }
    const image = findImage({ type: 'root', children: tree.children })
    tree.children = image ? [image] : []
  }
}

function CoverImage({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img src={src} alt="" width={150} height={100} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

export default function ArchiveCover({ content, coverURL }: { content: string; coverURL?: string }) {
  return (
    <div className="archive-entry__cover">
      {coverURL ? <CoverImage key={coverURL} src={coverURL} /> : <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[firstImageOnly]}
        components={{ img: ({ src }) => <CoverImage key={src} src={src} /> }}
      >
        {content}
      </Markdown>}
    </div>
  )
}
