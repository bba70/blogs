export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} 昼白 · 独立开发者与写作者</p>
        <p>保持好奇，持续记录。</p>
      </div>
    </footer>
  )
}
