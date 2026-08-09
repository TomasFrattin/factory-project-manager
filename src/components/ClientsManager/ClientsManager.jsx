import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import Modal from '../Modal/Modal.jsx'
import './ClientsManager.css'

const createInitialForm = () => ({
  company: '',
  name: '',
  cuit: '',
  contact: '',
})

function ClientsManager({ user, notify }) {
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState(createInitialForm())
  const [editingClientId, setEditingClientId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadClients = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const clientsRef = collection(db, 'clients')
      const clientsQuery = query(clientsRef, where('userId', '==', user.uid))
      const snapshot = await getDocs(clientsQuery)

      const loadedClients = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))

      loadedClients.sort((a, b) => {
        const companyA = String(a.company || '').toLowerCase()
        const companyB = String(b.company || '').toLowerCase()

        if (companyA > companyB) {
          return 1
        }

        if (companyA < companyB) {
          return -1
        }

        const nameA = String(a.name || '').toLowerCase()
        const nameB = String(b.name || '').toLowerCase()

        if (nameA > nameB) {
          return 1
        }

        if (nameA < nameB) {
          return -1
        }

        return 0
      })

      setClients(loadedClients)
    } catch (error) {
      console.error('Error al cargar clientes:', error)
      setErrorMessage('No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [user.uid])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setFormData(createInitialForm())
    setEditingClientId(null)
  }

  const closeForm = () => {
    resetForm()
    setIsFormOpen(false)
  }

  const closeDeleteModal = () => {
    setClientToDelete(null)
  }

  const handleOpenCreateForm = () => {
    resetForm()
    setErrorMessage('')
    setIsFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')

    try {
      const payload = {
        company: formData.company.trim(),
        name: formData.name.trim(),
        cuit: formData.cuit.trim(),
        contact: formData.contact.trim(),
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
      }

      if (editingClientId) {
        await updateDoc(doc(db, 'clients', editingClientId), payload)
        notify?.({
          message: `Se ha modificado el cliente "${payload.company}" correctamente.`,
          tone: 'success',
        })
      } else {
        await addDoc(collection(db, 'clients'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        notify?.({
          message: `Se ha creado el cliente "${payload.company}" satisfactoriamente.`,
          tone: 'success',
        })
      }

      await loadClients()
      closeForm()
    } catch (error) {
      console.error('Error al guardar cliente:', error)
      setErrorMessage('No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (client) => {
    setEditingClientId(client.id)
    setIsFormOpen(true)
    setErrorMessage('')
    setFormData({
      company: client.company || '',
      name: client.name || '',
      cuit: client.cuit || '',
      contact: client.contact || '',
    })
  }

  const handleDelete = async () => {
    if (!clientToDelete) {
      return
    }

    setDeleting(true)

    try {
      const deletedCompany = clientToDelete.company || 'cliente'
      await deleteDoc(doc(db, 'clients', clientToDelete.id))

      if (editingClientId === clientToDelete.id) {
        closeForm()
      }

      await loadClients()
      closeDeleteModal()
      notify?.({
        message: `Se ha eliminado el cliente "${deletedCompany}" correctamente.`,
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al eliminar cliente:', error)
      setErrorMessage('No se pudo eliminar el cliente.')
      notify?.({
        message: 'No se pudo eliminar el cliente.',
        tone: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="clients-manager" aria-label="ABM clientes">
      <div className="clients-manager-header">
        <h2>Clientes</h2>
        <div className="clients-manager-actions">
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="clients-action clients-action--primary ui-button-with-icon"
            data-tour="clients-create-button"
          >
            <Plus className="ui-button-icon" aria-hidden="true" />
            Cliente
          </button>
        </div>
      </div>

      <div className="clients-list-wrap">
        <h3>Listado de clientes</h3>
        {loading ? (
          <p>Cargando clientes...</p>
        ) : clients.length === 0 ? (
          <p>No hay clientes cargados.</p>
        ) : (
          <div className="clients-table-scroll" data-tour="clients-table">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Nombre</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.company || '-'}</td>
                    <td>{client.name || '-'}</td>
                    <td>{client.cuit || '-'}</td>
                    <td>{client.contact || '-'}</td>
                    <td className="clients-actions-cell">
                      <div className="clients-actions-content">
                        <button
                          type="button"
                          onClick={() => handleEdit(client)}
                          className="clients-row-button ui-button-with-icon"
                          aria-label="Editar cliente"
                          title="Editar cliente"
                        >
                          <Pencil className="ui-button-icon" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setClientToDelete(client)}
                          className="clients-row-button clients-row-button--danger ui-button-with-icon"
                          aria-label="Eliminar cliente"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="ui-button-icon" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingClientId ? 'Editar cliente' : 'Nuevo cliente'}
        isBusy={saving}
      >
        <form className="clients-form clients-form--modal" onSubmit={handleSubmit}>
          <label htmlFor="client-company">Empresa</label>
          <input
            id="client-company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            required
          />

          <label htmlFor="client-name">Nombre</label>
          <input
            id="client-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="client-cuit">CUIT</label>
          <input
            id="client-cuit"
            name="cuit"
            value={formData.cuit}
            onChange={handleChange}
            required
          />

          <label htmlFor="client-contact">Contacto</label>
          <input
            id="client-contact"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            required
          />

          <button type="submit" className="clients-submit" disabled={saving}>
            {saving
              ? <span className="ui-inline-loader">Guardando...</span>
              : editingClientId
                ? 'Actualizar cliente'
                : 'Crear cliente'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(clientToDelete)}
        onClose={closeDeleteModal}
        title="Eliminar cliente"
        size="sm"
        actions={
          <>
            <button type="button" className="modal-button" onClick={closeDeleteModal}>
              Cancelar
            </button>
            <button type="button" className="modal-button modal-button--danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <span className="ui-inline-loader">Eliminando...</span> : 'Eliminar'}
            </button>
          </>
        }
        isBusy={deleting}
      >
        <p>
          Vas a eliminar el cliente{' '}
          <strong>{clientToDelete?.company || 'seleccionado'}</strong>. Esta accion no se
          puede deshacer.
        </p>
      </Modal>

      {errorMessage ? <p className="clients-error">{errorMessage}</p> : null}
    </section>
  )
}

export default ClientsManager
