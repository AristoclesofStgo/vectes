import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'

export default function Journal() {
  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Your own MetaTrader 4 trades, analysed and plotted on the same market data as the rest of Vectes."
      />
      <ComingSoon
        items={[
          ['MT4 auto-sync', 'Attach the Vectes Expert Advisor to any chart and every closed trade is sent here automatically, with a private token you can revoke at any time.'],
          ['Statement import', 'Upload an MT4 Detailed Statement (.htm). It is parsed in your browser, symbols are mapped to Vectes assets and duplicates are skipped.'],
          ['Performance', 'Net P&L, win rate, profit factor, expectancy, drawdown, an equity curve and a daily P&L calendar.'],
          ['Trades on the chart', 'Entries and exits drawn on the Vectes candles, with notes and tags for every trade.'],
        ]}
      />
    </>
  )
}
