import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.js'

// Gate for every tab: without a session the visitor goes to /login and comes back after
export default function RequireAuth() {
  const session = useAuth((s) => s.session)
  const signedOut = useAuth((s) => s.signedOut)
  const location = useLocation()
  if (!session || session.expiresAt <= Date.now()) {
    if (signedOut) return <Navigate to="/" replace />
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
