import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'

export default function DataLab() {
  return (
    <>
      <PageHeader
        title="Data Lab"
        subtitle="How the data behind Vectes is extracted, cleaned, validated and served."
      />
      <ComingSoon items={[
        ['Pipeline architecture', 'From AWS Lambda and Snowflake to the scheduled GitHub Actions refresh.'],
        ['Data quality', 'Duplicates removed, stale points flagged and pipeline captures reconciled against a reference source.'],
        ['Data dictionary', 'Every table and field, with types and descriptions.'],
        ['SQL playground', 'Query the dataset with SQL directly in your browser.'],
      ]} />
    </>
  )
}
