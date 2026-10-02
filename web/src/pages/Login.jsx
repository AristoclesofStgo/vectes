import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { ThemeToggle } from '../components/Header.jsx'
import { useAuth, hasAccess, rememberDestination, DEMO_DAYS } from '../lib/auth.js'

// Supabase error messages are written for developers; show visitors something clearer
function friendly(error) {
  const msg = error?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link.'
  if (/already registered/i.test(msg)) return 'An account with this email already exists. Try logging in.'
  if (/password should be/i.test(msg)) return 'Use a password with at least 8 characters.'
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  return 'Something went wrong. Please try again.'
}

// /login and /signup share one form
export default function Login({ mode = 'login' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuth((s) => s.status)
  const session = useAuth((s) => s.session)
  const { startDemo, signIn, signUp } = useAuth.getState()
  const [busy, setBusy] = useState(null) // 'form' | 'google' | 'demo'
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const isSignup = mode === 'signup'
  const from = location.state?.from && location.state.from !== '/' ? location.state.from : '/market'
  const expired = location.state?.expired

  // Already signed in (e.g. opened /login from a bookmark)
  if (status === 'ready' && hasAccess(session) && !busy) return <Navigate to={from} replace />

  const run = async (kind, action) => {
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (e) {
      setError(kind === 'demo' ? 'The demo could not start. Please try again in a moment.' : friendly(e))
      setBusy(null)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    run('form', async () => {
      if (isSignup) {
        rememberDestination(from)
        const created = await signUp(email, password)
        if (!created) {
          setNotice(`We sent a confirmation link to ${email}. Open it to finish creating your account.`)
          setBusy(null)
          return
        }
      } else {
        await signIn(email, password)
      }
      navigate(from, { replace: true })
    })
  }

  // Google sign-in is shown for completeness but not wired to a provider in this portfolio build
  const google = () => {
    setError(null)
    setNotice('Google sign-in is not enabled in this portfolio build. Log in with email or try the demo.')
  }

  const demo = () => run('demo', async () => {
    await startDemo()
    navigate(from, { replace: true })
  })

  return (
    <div className="auth-page">
      <header className="auth-top">
        <Link to="/" className="brand" aria-label="Vectes home"><Logo size={24} /></Link>
        <ThemeToggle />
      </header>

      <main className="auth-main">
        {expired && (
          <p className="auth-notice" role="status">
            Your {DEMO_DAYS}-day demo has ended. Create a free account to keep using Vectes with your own trades.
          </p>
        )}

        <section className="card auth-card">
          <h1>{isSignup ? 'Create your account' : 'Log in to Vectes'}</h1>
          <p className="muted">
            {isSignup ? 'Sync your MT4 trades and keep your journal in one place.' : 'Welcome back. Your journal is waiting.'}
          </p>

          <button className="button lg full" type="button" onClick={google} disabled={Boolean(busy)}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>

          <div className="divider"><span>or</span></div>

          <form className="auth-form" onSubmit={submit}>
            <label>
              <span className="field-label">Email</span>
              <input className="input" type="email" name="email" autoComplete="email" required />
            </label>
            <label>
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                name="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </label>
            <button className="button primary lg full" type="submit" disabled={Boolean(busy)}>
              {busy === 'form' ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>

          {isSignup && (
            <p className="muted small">
              By creating an account you accept the <Link className="link accent" to="/privacy">privacy notice and terms</Link>. Vectes is not investment advice.
            </p>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}

          <p className="muted small auth-switch">
            {isSignup ? <>Already have an account? <Link className="link accent" to="/login" state={location.state}>Log in</Link></>
              : <>New to Vectes? <Link className="link accent" to="/signup" state={location.state}>Create an account</Link></>}
          </p>
        </section>

        <section className="auth-demo">
          <h2>Just looking?</h2>
          <p className="muted">Explore every tab with sample trades for {DEMO_DAYS} days. No sign-up needed.</p>
          <button className="button lg" onClick={demo} disabled={Boolean(busy)}>
            {busy === 'demo' ? 'Preparing demo…' : 'Try the demo'}
          </button>
        </section>
      </main>
    </div>
  )
}
