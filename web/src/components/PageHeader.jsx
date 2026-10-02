export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  )
}

export function ComingSoon({ items }) {
  return (
    <div className="coming-grid">
      {items.map(([title, text]) => (
        <section key={title} className="card coming">
          <span className="badge">Coming soon</span>
          <h2>{title}</h2>
          <p className="muted">{text}</p>
        </section>
      ))}
    </div>
  )
}
