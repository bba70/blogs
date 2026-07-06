import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="mt-4 text-gray-500">页面不存在</p>
      <Link to="/" className="mt-6 text-primary hover:text-primary-dark">
        返回首页
      </Link>
    </div>
  )
}
