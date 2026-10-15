interface PaginationProps {
  page: number
  perPage: number
  total: number
  label?: string
  disabled?: boolean
  onPageChange: (page: number) => void
}

export default function Pagination({ page, perPage, total, label = '文章分页', disabled = false, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages < 1) return null
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)
  const items = pages.flatMap((value, index): (number | string)[] =>
    index > 0 && value - pages[index - 1] > 1 ? [`gap-${value}`, value] : [value],
  )

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 py-9" aria-label={label} aria-busy={disabled}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        className="min-h-11 rounded-[10px] border border-line bg-white px-4 text-sm text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        上一页
      </button>
      {items.map((currentPage) => typeof currentPage === 'string' ? (
        <span key={currentPage} aria-hidden="true" className="px-1 text-muted">…</span>
      ) : (
        <button
          type="button"
          key={currentPage}
          disabled={disabled || currentPage === page}
          aria-label={`第 ${currentPage} 页`}
          onClick={() => onPageChange(currentPage)}
          aria-current={currentPage === page ? 'page' : undefined}
          className={`min-h-11 min-w-11 rounded-[10px] border px-3 text-sm ${
            currentPage === page ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted hover:border-primary hover:text-primary'
          }`}
        >
          {currentPage}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
        className="min-h-11 rounded-[10px] border border-line bg-white px-4 text-sm text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一页
      </button>
      <span className="text-xs text-muted">第 {page} / {totalPages} 页 · 共 {total} 篇</span>
    </nav>
  )
}
