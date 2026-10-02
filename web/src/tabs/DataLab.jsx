import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import CoverageTable from '../components/datalab/CoverageTable.jsx'
import DataDictionary from '../components/datalab/DataDictionary.jsx'
import PipelineDiagram from '../components/datalab/PipelineDiagram.jsx'
import QualityReport from '../components/datalab/QualityReport.jsx'
import Reconciliation from '../components/datalab/Reconciliation.jsx'
import SqlPlayground from '../components/datalab/SqlPlayground.jsx'
import { useJson } from '../lib/data.js'
import { useStore } from '../store.js'

export default function DataLab() {
  const quality = useJson('quality.json')
  const pipeline = useJson('pipeline.json')
  const assets = useJson('assets.json')
  const theme = useStore((s) => s.theme)
  const [reconAsset, setReconAsset] = useState('BTC')

  const names = useMemo(
    () => Object.fromEntries((assets.data?.assets ?? []).map((a) => [a.id, a.name])),
    [assets.data],
  )

  if (quality.error || pipeline.error || assets.error) {
    return <div className="card error">Could not load the data quality report. Please try again later.</div>
  }

  return (
    <>
      <PageHeader
        title="Data Lab"
        subtitle="How the data behind Vectes is extracted, cleaned, validated and served — and a SQL console to explore it yourself."
      />

      <PipelineDiagram quality={quality.data} />

      {quality.data && pipeline.data ? (
        <>
          <QualityReport pipeline={quality.data.pipeline} />
          <Reconciliation pipeline={pipeline.data} names={names} selected={reconAsset} onSelect={setReconAsset} theme={theme} />
        </>
      ) : (
        <div className="card skeleton" style={{ height: 420 }} />
      )}

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
