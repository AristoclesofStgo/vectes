import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Market from './tabs/Market.jsx'
import Analysis from './tabs/Analysis.jsx'
import Portfolio from './tabs/Portfolio.jsx'
import DataLab from './tabs/DataLab.jsx'

export default function App() {
  const location = useLocation()
  return (
    <div className="app">
      <Header />
      <main className="main">
        <ErrorBoundary resetKey={location.pathname + location.search}>
        <Routes>
          <Route path="/" element={<Market />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/data-lab" element={<DataLab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
