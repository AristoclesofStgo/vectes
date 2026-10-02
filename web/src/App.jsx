import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'

// Each tab is its own chunk so visitors only download the charts they open
const Market = lazy(() => import('./tabs/Market.jsx'))
const Analysis = lazy(() => import('./tabs/Analysis.jsx'))
const Portfolio = lazy(() => import('./tabs/Portfolio.jsx'))
const DataLab = lazy(() => import('./tabs/DataLab.jsx'))

export default function App() {
  const location = useLocation()
  return (
    <div className="app">
      <Header />
      <main className="main">
        <ErrorBoundary resetKey={location.pathname + location.search}>
          <Suspense fallback={<div className="card skeleton" style={{ height: 480 }} />}>
            <Routes>
              <Route path="/" element={<Market />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/data-lab" element={<DataLab />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
