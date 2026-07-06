export interface PaginationMeta {
  page: number
  per_page: number
  total: number
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  code: number
  message: string
  data: T[]
  meta: PaginationMeta
}
