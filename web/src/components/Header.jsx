import { NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useStore } from '../store.js'
import { useJson } from '../lib/data.js'
import { useAuth, daysLeft } from '../lib/auth.js'

export const TABS = [
  { path: '/market',    label: 'Market' },
  { path: '/analysis',  label: 'Analysis' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/journal',   label: 'Journal' },
  { path: '/data-lab',  label: 'Data Lab' },
]

export function ThemeToggle() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button className="icon-button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  )
}

function DataFreshness() {
  const { data } = useJson('quality.json')
  if (!data) return null
  const updated = new Date(data.extracted_at ?? data.generated_at)
  const label = updated.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
  return (
    <span className="freshness" title="Last data refresh">
      <span className="dot" aria-hidden="true" />
      Updated {label}
    </span>
  )
}

function Account() {
  const session = useAuth((s) => s.session)
  const signOut = useAuth((s) => s.signOut)
  if (!session) return null
  const left = daysLeft(session)
  return (
    <div className="account">
      <NavLink to="/account" className="account-link" title="Your account">
        {session.kind === 'demo' ? (
          <span className="badge">Demo · {left} {left === 1 ? 'day' : 'days'} left</span>
        ) : (
          <span className="account-email muted small hide-sm">{session.email}</span>
        )}
      </NavLink>
      <button className="button ghost" onClick={signOut}>Sign out</button>
    </div>
  )
}

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="Vectes home"><Logo size={26} /></NavLink>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <NavLink key={t.path} to={t.path} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <DataFreshness />
          <ThemeToggle />
          <Account />
        </div>
      </div>
    </header>
  )
}
