import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="muted">For educational purposes only, not investment advice.</p>
        <Link className="muted link" to="/privacy">Privacy &amp; terms</Link>
        <a className="muted link" href="https://github.com/AristoclesofStgo/aurum-etl" target="_blank" rel="noreferrer">
          Original AWS pipeline
        </a>
      </div>
    </footer>
  )
}
