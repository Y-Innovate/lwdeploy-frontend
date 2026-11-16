import { Link } from 'react-router'
import { SIGN_OUT_URL } from '../api/auth'
import { useSession } from '../context/SessionContext'
import { PATHS } from '../routes'

// Who is signed in, linking to the profile, and the sign-out button.
// There's no name in GET /me: the RACF userid is what everyone knows a user
// by here.
export default function UserBadge() {
  const { user, isAdmin } = useSession()
  if (!user) return null

  return (
    <div className="flex items-center gap-2">
      <div className="hidden min-w-0 text-right sm:block">
        <Link to={PATHS.profile} className="block truncate text-[13px] leading-tight hover:underline" title="Profile">
          {user.userID}
        </Link>
        {isAdmin && <div className="truncate text-[11px] text-header-fg-2">Administrator</div>}
      </div>
      <Link to={PATHS.profile} className="header-link sm:hidden" aria-label="Profile">
        <i className="ti ti-user" aria-hidden="true" />
      </Link>
      <a href={SIGN_OUT_URL} className="btn-secondary header-signin ml-1">
        <i className="ti ti-logout" aria-hidden="true" />
        Sign out
      </a>
    </div>
  )
}
