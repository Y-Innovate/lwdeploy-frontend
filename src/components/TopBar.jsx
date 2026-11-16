import { Link, NavLink } from 'react-router'
import { useSession } from '../context/SessionContext'
import { ADMIN_PATHS, PATHS } from '../routes'
import UserBadge from './UserBadge'

const linkClass = ({ isActive }) => `header-link ${isActive ? 'header-link-active' : ''}`

// The brand mark: public/olifantje.svg as a mask, so it takes the brand
// color (bg-brand) of the theme, also in dark mode
const MARK_URL = `url(${import.meta.env.BASE_URL}olifantje.svg)`
const MARK_STYLE = {
  maskImage: MARK_URL, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
  WebkitMaskImage: MARK_URL, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
}

// The approvals link carries the number waiting (GET /me approvalsWaiting);
// administrators also get Admin
export default function TopBar() {
  const { user, approvalsWaiting, isAdmin } = useSession()
  return (
    <header className="app-header">
      <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-3 px-4">
        <Link to={PATHS.home} className="flex items-center gap-2 text-[14px] font-medium tracking-[-0.3px]">
          <span className="h-[18px] w-[22px] shrink-0 bg-brand" style={MARK_STYLE} aria-hidden="true" />
          Y-Innovate LWD
        </Link>
        {user && (
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to={PATHS.home} end className={linkClass}>
              Applications
            </NavLink>
            <NavLink to={PATHS.approvals} className={linkClass}>
              Approvals
              {approvalsWaiting > 0 && (
                <span
                  className="ml-1.5 rounded-full bg-warning-bg px-1.5 text-[11px] font-medium text-warning-fg"
                  aria-label={`${approvalsWaiting} waiting`}
                >
                  {approvalsWaiting}
                </span>
              )}
            </NavLink>
            {isAdmin && (
              <NavLink to={ADMIN_PATHS.applications} className={linkClass}>
                Admin
              </NavLink>
            )}
          </nav>
        )}
        <div className="ml-auto">
          <UserBadge />
        </div>
      </div>
    </header>
  )
}
