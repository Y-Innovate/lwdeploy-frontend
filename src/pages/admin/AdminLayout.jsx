import { Link, Outlet, useLocation } from 'react-router'
import { ADMIN_NAV } from '../../routes'

// The administrators' navigation above every admin page
export default function AdminLayout() {
  const { pathname } = useLocation()
  const isActive = (item) => pathname === item.path || item.also.includes(pathname)

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap items-center gap-1 border-b-[0.5px] border-line pb-2" aria-label="Admin">
        <span className="mr-2 text-[11px] font-medium uppercase tracking-wide text-fg-3">Administrator</span>
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive(item) ? 'page' : undefined}
            className={`tab ${isActive(item) ? 'tab-active' : ''}`}
          >
            <i className={`ti ${item.icon} text-base`} aria-hidden="true" />
            {item.title}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
