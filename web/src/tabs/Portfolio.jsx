import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'

export default function Portfolio() {
  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Build a multi-asset portfolio and see how it would have performed over the past year."
      />
      <ComingSoon items={[
        ['Allocation builder', 'Split your capital across crypto, metals, energy, currencies and indices.'],
        ['Lump sum vs. DCA', 'Invest everything on day one or a fixed amount every week.'],
        ['Rebalancing', 'Compare never, monthly and threshold-based rebalancing.'],
        ['Efficient frontier', 'See where your portfolio sits among thousands of random allocations.'],
      ]} />
    </>
  )
}
