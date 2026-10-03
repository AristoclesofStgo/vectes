import PageHeader from '../components/PageHeader.jsx'
import DataDictionary from '../components/datalab/DataDictionary.jsx'
import SqlPlayground from '../components/datalab/SqlPlayground.jsx'

export default function DataLab() {
  return (
    <>
      <PageHeader
        title="Data Lab"
        subtitle="How the data behind Vectes is extracted, cleaned, validated and served, and a SQL console to explore it yourself."
      />

      <SqlPlayground />

      <DataDictionary />
    </>
  )
}
