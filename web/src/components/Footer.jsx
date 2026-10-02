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
        <a className="muted link" href="https://github.com/AristoclesofStgo/aurum-etl" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </div>
    </footer>
  )
}
