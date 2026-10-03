import { useState } from 'react'

// Irreversible actions ask the visitor to type a word first (an account number, "DELETE")
export default function ConfirmDelete({ title, children, word, action, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch {
      setError('That did not work. Nothing was deleted. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form className="confirm-delete" onSubmit={confirm} role="alertdialog" aria-labelledby="confirm-title">
      <h3 id="confirm-title">{title}</h3>
      <div className="muted small confirm-body">{children}</div>
      <label>
        <span className="field-label">Type <strong>{word}</strong> to confirm</span>
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
      </label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="confirm-actions">
        <button className="button danger" type="submit" disabled={typed.trim() !== word || busy}>{busy ? 'Deleting…' : action}</button>
        <button className="button ghost" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
