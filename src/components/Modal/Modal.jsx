import { useEffect } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

function Modal({
  isOpen,
  title,
  onClose,
  children,
  actions,
  size = 'md',
  closeOnBackdrop = true,
  isBusy = false,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isBusy, onClose])

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop && !isBusy) {
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <section
        className={`modal-panel modal-panel--${size} ${isBusy ? 'modal-panel--busy' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            <X className="modal-close-icon" aria-hidden="true" />
          </button>
        </header>

        <div className="modal-content">{children}</div>

        {actions ? <footer className="modal-footer">{actions}</footer> : null}
      </section>
    </div>
  )
}

export default Modal
