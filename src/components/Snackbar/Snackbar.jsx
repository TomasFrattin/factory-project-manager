import { useEffect } from 'react'
import './Snackbar.css'

function Snackbar({ open, message, tone = 'success', onClose, duration = 2800 }) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const timeoutId = window.setTimeout(onClose, duration)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [duration, onClose, open])

  if (!open || !message) {
    return null
  }

  return (
    <div className="snackbar-region" aria-live="polite" aria-atomic="true">
      <div className={`snackbar snackbar--${tone}`} role="status">
        <p>{message}</p>
        <button type="button" onClick={onClose} className="snackbar-close">
          Cerrar
        </button>
      </div>
    </div>
  )
}

export default Snackbar
