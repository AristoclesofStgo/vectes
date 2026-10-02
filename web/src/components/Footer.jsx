import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Logo size={20} tagline />
        <p className="muted">
          Data from Yahoo Finance and CoinGecko, refreshed daily by GitHub Actions.
          Original pipeline: AWS Lambda, S3, EventBridge and Snowflake.
          For educational purposes only — not investment advice.
        </p>
        <Link className="muted link" to="/privacy">Privacy &amp; terms</Link>
        <a className="muted link" href="https://github.com/AristoclesofStgo/vectes" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
        <a className="muted link" href="https://github.com/AristoclesofStgo/aurum-etl" target="_blank" rel="noreferrer">
          Original AWS pipeline
        </a>
      </div>
    </footer>
  )
}
