import { useMemo } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import CoverageTable from '../components/datalab/CoverageTable.jsx'
import DataDictionary from '../components/datalab/DataDictionary.jsx'
import SqlPlayground from '../components/datalab/SqlPlayground.jsx'
import { useJson } from '../lib/data.js'

export default function DataLab() {
  const quality = useJson('quality.json')
  const assets = useJson('assets.json')

  const names = useMemo(
    () => Object.fromEntries((assets.data?.assets ?? []).map((a) => [a.id, a.name])),
    [assets.data],
  )

  if (quality.error || assets.error) {
    return <div className="card error">Could not load the data quality report. Please try again later.</div>
  }

  return (
    <>
      <PageHeader
        title="Data Lab"
        subtitle="How the data behind Vectes is extracted, cleaned, validated and served, and a SQL console to explore it yourself."
      />

      <SqlPlayground />

      {quality.data && <CoverageTable history={quality.data.history} names={names} />}

      <DataDictionary />

      {quality.data && (
        <section className="card notes" aria-label="Processing notes">
          <h2>Processing notes</h2>
          <ul>
            {quality.data.notes.map((n) => <li key={n} className="muted">{n}</li>)}
          </ul>
        </section>
      )}
    </>
  )
}
