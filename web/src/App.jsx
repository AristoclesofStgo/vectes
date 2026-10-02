import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import { useAuth, hasAccess, takeDestination } from './lib/auth.js'

// Each page is its own chunk so visitors only download the charts they open
const Login = lazy(() => import('./pages/Login.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Account = lazy(() => import('./pages/Account.jsx'))
const Market = lazy(() => import('./tabs/Market.jsx'))
const Analysis = lazy(() => import('./tabs/Analysis.jsx'))
const Portfolio = lazy(() => import('./tabs/Portfolio.jsx'))
const Journal = lazy(() => import('./tabs/Journal.jsx'))
const DataLab = lazy(() => import('./tabs/DataLab.jsx'))

const fallback = <div className="card skeleton" style={{ height: 480 }} />

// Header + tabs around every signed-in page
function AppLayout() {
  const location = useLocation()
  return (
    <div className="app">
      <Header />
      <main className="main">
        <ErrorBoundary resetKey={location.pathname + location.search}>
          <Suspense fallback={fallback}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}

// Market used to live at "/": keep old shared links like /#/?asset=XAU working
function Landing() {
  const { search } = useLocation()
  return search ? <Navigate to={`/market${search}`} replace /> : <Home />
}

export default function App() {
  const navigate = useNavigate()
  const status = useAuth((s) => s.status)
  const session = useAuth((s) => s.session)

  useEffect(() => useAuth.getState().init(), [])

  // Back from Google or an email link: continue to the page the visitor wanted
  useEffect(() => {
    if (status !== 'ready' || !hasAccess(session)) return
    const to = takeDestination()
    if (to) navigate(to, { replace: true })
  }, [status, session, navigate])

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/signup" element={<Login mode="signup" />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/market" element={<Market />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/data-lab" element={<DataLab />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
