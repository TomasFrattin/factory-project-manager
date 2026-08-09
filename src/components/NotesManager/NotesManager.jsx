import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import './NotesManager.css'

const createInitialForm = () => ({
  titulo: '',
  contenido: '',
})

const formatDate = (value) => {
  if (!value) {
    return 'Sin fecha'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

const formatPeriod = (value) => {
  if (!value) {
    return 'Sin periodo'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Sin periodo'
  }

  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function NotesManager({ user, notify }) {
  const [notes, setNotes] = useState([])
  const [formState, setFormState] = useState(createInitialForm())
  const [expandedNoteId, setExpandedNoteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editFormState, setEditFormState] = useState(createInitialForm())
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    setErrorMessage('')

    const notesRef = collection(db, 'notes')
    const notesQuery = query(notesRef, where('userId', '==', user.uid))

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const loadedNotes = snapshot.docs
          .map((item) => {
            const data = item.data()

            return {
              id: item.id,
              titulo: String(data.titulo || data.title || '').trim(),
              contenido: String(data.contenido || data.content || '').trim(),
              fechaCreacion: data.fechaCreacion || data.createdOn || '',
            }
          })
          .filter((note) => note.titulo && note.contenido)

        loadedNotes.sort((a, b) => (a.fechaCreacion < b.fechaCreacion ? 1 : -1))
        setNotes(loadedNotes)
        setLoading(false)
      },
      (error) => {
        console.error('Error al cargar notas:', error)
        setErrorMessage('No se pudieron cargar las notas.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user.uid])

  const canSave = useMemo(() => {
    return Boolean(formState.titulo.trim() && formState.contenido.trim())
  }, [formState.contenido, formState.titulo])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormState((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const titulo = formState.titulo.trim()
    const contenido = formState.contenido.trim()

    if (!titulo || !contenido) {
      setErrorMessage('Completa el titulo y el contenido para guardar la nota.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      await addDoc(collection(db, 'notes'), {
        titulo,
        contenido,
        fechaCreacion: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setFormState(createInitialForm())
      notify?.({
        message: 'Nota creada correctamente.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al crear nota:', error)
      setErrorMessage('No se pudo crear la nota.')
      notify?.({
        message: 'No se pudo crear la nota.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleExpanded = (noteId) => {
    setExpandedNoteId((current) => (current === noteId ? null : noteId))

    if (editingNoteId && editingNoteId !== noteId) {
      setEditingNoteId(null)
      setEditFormState(createInitialForm())
    }
  }

  const handleStartEdit = (event, note) => {
    event.stopPropagation()
    setEditingNoteId(note.id)
    setExpandedNoteId(note.id)
    setEditFormState({
      titulo: note.titulo,
      contenido: note.contenido,
    })
  }

  const handleCancelEdit = (event) => {
    event.stopPropagation()
    setEditingNoteId(null)
    setEditFormState(createInitialForm())
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target

    setEditFormState((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleUpdate = async (event, note) => {
    event.stopPropagation()

    if (!note?.id || updating) {
      return
    }

    const titulo = editFormState.titulo.trim()
    const contenido = editFormState.contenido.trim()

    if (!titulo || !contenido) {
      setErrorMessage('El titulo y el contenido de la nota no pueden estar vacios.')
      return
    }

    setUpdating(true)
    setErrorMessage('')

    try {
      await updateDoc(doc(db, 'notes', note.id), {
        titulo,
        contenido,
        updatedAt: serverTimestamp(),
      })

      setEditingNoteId(null)
      setEditFormState(createInitialForm())
      notify?.({
        message: 'Nota actualizada correctamente.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al actualizar nota:', error)
      setErrorMessage('No se pudo actualizar la nota.')
      notify?.({
        message: 'No se pudo actualizar la nota.',
        tone: 'error',
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (event, note) => {
    event.stopPropagation()

    if (!note?.id || deletingId) {
      return
    }

    setDeletingId(note.id)

    try {
      await deleteDoc(doc(db, 'notes', note.id))

      setExpandedNoteId((current) => (current === note.id ? null : current))
      notify?.({
        message: `Se elimino la nota "${note.titulo}".`,
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al eliminar nota:', error)
      setErrorMessage('No se pudo eliminar la nota.')
      notify?.({
        message: 'No se pudo eliminar la nota.',
        tone: 'error',
      })
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="notes-manager" aria-label="Tablero de notas">
      <header className="notes-manager-header">
        <h2>Notas</h2>
        <p>Crea notas rapidas, expandelas para leer el contenido y elimina las que ya no uses.</p>
      </header>

      <form className="notes-form" onSubmit={handleSubmit}>
        <div className="notes-field">
          <label htmlFor="note-title">Titulo</label>
          <input
            id="note-title"
            name="titulo"
            value={formState.titulo}
            onChange={handleChange}
            placeholder="Ej: Reunión con cliente"
            maxLength={90}
            required
          />
        </div>

        <div className="notes-field notes-field--full">
          <label htmlFor="note-content">Contenido</label>
          <textarea
            id="note-content"
            name="contenido"
            value={formState.contenido}
            onChange={handleChange}
            placeholder="Escribe tu nota..."
            rows={4}
            required
          />
        </div>

        <button
          type="submit"
          className="notes-submit ui-button-with-icon"
          disabled={saving || !canSave}
        >
          <Plus className="ui-button-icon" aria-hidden="true" />
          {saving ? 'Guardando...' : 'Agregar nota'}
        </button>
      </form>

      {errorMessage ? <p className="notes-error">{errorMessage}</p> : null}

      <section className="notes-grid" aria-label="Listado de notas">
        {loading ? <p>Cargando notas...</p> : null}
        {!loading && notes.length === 0 ? <p>No hay notas todavia.</p> : null}

        {!loading
          ? notes.map((note) => {
              const isExpanded = expandedNoteId === note.id

              return (
                <article
                  key={note.id}
                  className={`notes-card${isExpanded ? ' notes-card--expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleExpanded(note.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleToggleExpanded(note.id)
                    }
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`Nota ${note.titulo}`}
                >
                  <header className="notes-card-head">
                    <h3>{note.titulo}</h3>
                    <p>Periodo: {formatPeriod(note.fechaCreacion)}</p>
                    <p>Creada: {formatDate(note.fechaCreacion)}</p>
                  </header>

                  {isExpanded ? (
                    <div
                      className="notes-card-body"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {editingNoteId === note.id ? (
                        <div className="notes-edit-wrap">
                          <div className="notes-field">
                            <label htmlFor={`note-edit-title-${note.id}`}>Titulo</label>
                            <input
                              id={`note-edit-title-${note.id}`}
                              name="titulo"
                              value={editFormState.titulo}
                              onChange={handleEditChange}
                              maxLength={90}
                            />
                          </div>

                          <div className="notes-field">
                            <label htmlFor={`note-edit-content-${note.id}`}>Contenido</label>
                            <textarea
                              id={`note-edit-content-${note.id}`}
                              name="contenido"
                              value={editFormState.contenido}
                              onChange={handleEditChange}
                              rows={5}
                            />
                          </div>

                          <div className="notes-actions-row">
                            <button
                              type="button"
                              className="notes-save ui-button-with-icon"
                              onClick={(event) => handleUpdate(event, note)}
                              disabled={updating}
                            >
                              <Save className="ui-button-icon" aria-hidden="true" />
                              {updating ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className="notes-cancel ui-button-with-icon"
                              onClick={handleCancelEdit}
                              disabled={updating}
                            >
                              <X className="ui-button-icon" aria-hidden="true" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p>{note.contenido}</p>
                          <div className="notes-actions-row">
                            <button
                              type="button"
                              className="notes-edit ui-button-with-icon"
                              onClick={(event) => handleStartEdit(event, note)}
                              aria-label={`Editar nota ${note.titulo}`}
                              title="Editar nota"
                            >
                              <Pencil className="ui-button-icon" aria-hidden="true" />
                              Editar
                            </button>
                            <button
                              type="button"
                              className="notes-delete ui-button-with-icon"
                              onClick={(event) => handleDelete(event, note)}
                              disabled={deletingId === note.id}
                              aria-label={`Eliminar nota ${note.titulo}`}
                              title="Eliminar nota"
                            >
                              <Trash2 className="ui-button-icon" aria-hidden="true" />
                              {deletingId === note.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })
          : null}
      </section>
    </section>
  )
}

export default NotesManager
