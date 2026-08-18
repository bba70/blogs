interface PaginationProps {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 py-9" aria-label="文章分页">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="min-h-10 rounded-[10px] border border-line bg-white px-4 text-sm text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        上一页
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((currentPage) => (
        <button
          type="button"
          key={currentPage}
          onClick={() => onPageChange(currentPage)}
          aria-current={currentPage === page ? 'page' : undefined}
          className={`min-h-10 min-w-10 rounded-[10px] border px-3 text-sm ${
            currentPage === page ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted hover:border-primary hover:text-primary'
          }`}
        >
          {currentPage}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="min-h-10 rounded-[10px] border border-line bg-white px-4 text-sm text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一页
      </button>
    </nav>
  )
}
