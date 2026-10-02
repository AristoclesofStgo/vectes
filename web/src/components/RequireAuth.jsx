import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, hasAccess } from '../lib/auth.js'

// Gate for every tab: without a valid session the visitor goes to /login and comes back after
export default function RequireAuth() {
  const status = useAuth((s) => s.status)
  const session = useAuth((s) => s.session)
  const signedOut = useAuth((s) => s.signedOut)
  const location = useLocation()

  if (status === 'loading') return <div className="gate-loading" aria-busy="true" />
  if (!hasAccess(session)) {
    if (signedOut) return <Navigate to="/" replace />
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, expired: Boolean(session) }}
      />
    )
  }
  return <Outlet />
}
