import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'
import ConnectMT4 from '../components/journal/ConnectMT4.jsx'

export default function Journal() {
  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Your own MetaTrader 4 trades, analysed and plotted on the same market data as the rest of Vectes."
      />
      <ConnectMT4 />
      <ComingSoon
        items={[
          ['Performance', 'Net P&L, win rate, profit factor, expectancy, drawdown, an equity curve and a daily P&L calendar.'],
          ['Trades on the chart', 'Entries and exits drawn on the Vectes candles, with notes and tags for every trade.'],
          ['Statement import', 'Upload an MT4 Detailed Statement (.htm). It is parsed in your browser, symbols are mapped to Vectes assets and duplicates are skipped.'],
        ]}
      />
    </>
  )
}
