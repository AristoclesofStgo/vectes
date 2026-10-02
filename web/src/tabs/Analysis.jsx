import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'

export default function Analysis() {
  return (
    <>
      <PageHeader
        title="Analysis"
        subtitle="How assets move together, how risky they are, and the classic market ratios."
      />
      <ComingSoon items={[
        ['Correlation heatmap', 'Pairwise correlation of daily returns with an adjustable time window.'],
        ['Risk vs. return', 'Annualized volatility, return and maximum drawdown for every asset.'],
        ['Rolling correlation', 'Track how the relationship between two assets changes over time.'],
        ['Market ratios', 'Gold/silver ratio, Brent–WTI spread, BTC/ETH and Bitcoin priced in gold.'],
      ]} />
    </>
  )
}
