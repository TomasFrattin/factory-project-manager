import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
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
import { getBnaUsdRate } from '../../services/exchangeRate.js'
import Modal from '../Modal/Modal.jsx'
import './TariffsManager.css'

const TARIFF_TYPES = [
  { key: 'diseno', title: 'Costo por hora de diseno' },
  { key: 'fabrica', title: 'Costo por hora de fabrica' },
]

const formatUsd = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

const formatArs = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value)
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isValidTariffRecord = (item) => {
  const usdPerHour = Number.parseFloat(item?.usdPerHour)
  return Number.isFinite(usdPerHour) && usdPerHour > 0
}

function TariffsManager({ user, notify }) {
  const [tariffs, setTariffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [rateState, setRateState] = useState({
    loading: true,
    sell: null,
    updatedAt: null,
    error: '',
  })
  const [formState, setFormState] = useState({ diseno: '', fabrica: '' })
  const [savingState, setSavingState] = useState({ diseno: false, fabrica: false })
  const [editingTariff, setEditingTariff] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)
  const [tariffToDelete, setTariffToDelete] = useState(null)
  const [deletingTariff, setDeletingTariff] = useState(false)

  const loadTariffs = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const tariffsRef = collection(db, 'tariffs')
      const tariffsQuery = query(tariffsRef, where('userId', '==', user.uid))
      const snapshot = await getDocs(tariffsQuery)

      const loadedTariffs = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))

      loadedTariffs.sort((a, b) => {
        const dateA = a.createdOn || ''
        const dateB = b.createdOn || ''
        if (dateA > dateB) {
          return -1
        }
        if (dateA < dateB) {
          return 1
        }
        return 0
      })

      setTariffs(loadedTariffs)
    } catch (error) {
      console.error('Error al cargar tarifas:', error)
      setErrorMessage('No se pudieron cargar las tarifas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTariffs()
  }, [user.uid])

  useEffect(() => {
    let active = true

    const loadRate = async () => {
      setRateState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const rate = await getBnaUsdRate()

        if (!active) {
          return
        }

        setRateState({
          loading: false,
          sell: rate.sell,
          updatedAt: rate.updatedAt ?? null,
          error: '',
        })
      } catch (error) {
        if (!active) {
          return
        }

        setRateState({
          loading: false,
          sell: null,
          updatedAt: null,
          error: 'No se pudo obtener la cotizacion para mostrar estimados en ARS.',
        })
      }
    }

    loadRate()

    return () => {
      active = false
    }
  }, [])

  const groupedTariffs = useMemo(() => {
    return {
      diseno: tariffs.filter((item) => item.type === 'diseno' && isValidTariffRecord(item)),
      fabrica: tariffs.filter((item) => item.type === 'fabrica' && isValidTariffRecord(item)),
    }
  }, [tariffs])

  const handleChange = (type, value) => {
    setFormState((current) => ({
      ...current,
      [type]: value,
    }))
  }

  const handleCreateTariff = async (type) => {
    const usdPerHour = Number.parseFloat(String(formState[type]).replace(',', '.'))

    if (!Number.isFinite(usdPerHour) || usdPerHour <= 0) {
      notify?.({
        message: 'Ingresa un valor de USD por hora valido.',
        tone: 'error',
      })
      return
    }

    setSavingState((current) => ({ ...current, [type]: true }))

    try {
      const estimatedArsPerHour =
        typeof rateState.sell === 'number'
          ? Number((usdPerHour * rateState.sell).toFixed(2))
          : null

      await addDoc(collection(db, 'tariffs'), {
        type,
        usdPerHour: Number(usdPerHour.toFixed(2)),
        estimatedArsPerHour,
        estimatedRateUsed: rateState.sell,
        estimatedRateUpdatedAt: rateState.updatedAt ?? null,
        createdOn: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setFormState((current) => ({ ...current, [type]: '' }))
      await loadTariffs()

      notify?.({
        message: `Tarifa de ${type === 'diseno' ? 'diseno' : 'fabrica'} guardada correctamente.`,
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al guardar tarifa:', error)
      notify?.({
        message: 'No se pudo guardar la tarifa.',
        tone: 'error',
      })
    } finally {
      setSavingState((current) => ({ ...current, [type]: false }))
    }
  }

  const closeEditModal = () => {
    if (editingSaving) {
      return
    }

    setEditingTariff(null)
    setEditingValue('')
  }

  const handleOpenEditTariff = (tariff) => {
    setEditingTariff(tariff)
    setEditingValue(String(tariff.usdPerHour ?? ''))
  }

  const handleUpdateTariff = async () => {
    if (!editingTariff) {
      return
    }

    const usdPerHour = Number.parseFloat(String(editingValue).replace(',', '.'))

    if (!Number.isFinite(usdPerHour) || usdPerHour <= 0) {
      notify?.({
        message: 'Ingresa un valor de USD por hora valido.',
        tone: 'error',
      })
      return
    }

    setEditingSaving(true)

    try {
      const estimatedArsPerHour =
        typeof rateState.sell === 'number'
          ? Number((usdPerHour * rateState.sell).toFixed(2))
          : null

      await updateDoc(doc(db, 'tariffs', editingTariff.id), {
        usdPerHour: Number(usdPerHour.toFixed(2)),
        estimatedArsPerHour,
        estimatedRateUsed: rateState.sell,
        estimatedRateUpdatedAt: rateState.updatedAt ?? null,
        updatedAt: serverTimestamp(),
      })

      await loadTariffs()
      closeEditModal()
      notify?.({
        message: 'Tarifa actualizada correctamente.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al actualizar tarifa:', error)
      notify?.({
        message: 'No se pudo actualizar la tarifa.',
        tone: 'error',
      })
    } finally {
      setEditingSaving(false)
    }
  }

  const closeDeleteModal = () => {
    if (deletingTariff) {
      return
    }

    setTariffToDelete(null)
  }

  const handleDeleteTariff = async () => {
    if (!tariffToDelete) {
      return
    }

    setDeletingTariff(true)

    try {
      await deleteDoc(doc(db, 'tariffs', tariffToDelete.id))
      await loadTariffs()
      closeDeleteModal()
      notify?.({
        message: 'Tarifa eliminada correctamente.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al eliminar tarifa:', error)
      notify?.({
        message: 'No se pudo eliminar la tarifa.',
        tone: 'error',
      })
    } finally {
      setDeletingTariff(false)
    }
  }

  return (
    <section className="tariffs-manager" aria-label="Tarifas por hora">
      <header className="tariffs-manager-header">
        <h2>Tarifas</h2>
        <p>
          Define solo el costo por hora en USD. El valor en ARS se muestra como estimado
          informativo y no se edita manualmente.
        </p>
      </header>

      <div className="tariffs-rate-chip" role="status" aria-live="polite">
        {rateState.loading ? 'Cargando cotizacion para estimado ARS...' : null}
        {!rateState.loading && rateState.error ? rateState.error : null}
        {!rateState.loading && !rateState.error && typeof rateState.sell === 'number'
          ? `Estimado ARS usando BNA venta: ${formatArs(rateState.sell)} por USD${rateState.updatedAt ? ` (actualizado ${rateState.updatedAt})` : ''}.`
          : null}
      </div>

      {errorMessage ? <p className="tariffs-error">{errorMessage}</p> : null}

      <div className="tariffs-grid">
        {TARIFF_TYPES.map((typeConfig) => {
          const typeTariffs = groupedTariffs[typeConfig.key]
          const currentTariff = typeTariffs[0]
          const previewArs =
            Number.isFinite(Number.parseFloat(String(formState[typeConfig.key]).replace(',', '.'))) && typeof rateState.sell === 'number'
              ? Number((Number.parseFloat(String(formState[typeConfig.key]).replace(',', '.')) * rateState.sell).toFixed(2))
              : null

          return (
            <article key={typeConfig.key} className="tariffs-card">
              <h3>{typeConfig.title}</h3>

              <div className="tariffs-current">
                <span className="tariffs-current-label">Tarifa vigente</span>
                <strong>{currentTariff ? `${formatUsd(currentTariff.usdPerHour)} / h` : 'Sin datos'}</strong>
              </div>

              <form
                className="tariffs-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleCreateTariff(typeConfig.key)
                }}
              >
                <label htmlFor={`tariff-${typeConfig.key}`}>USD por hora</label>
                <input
                  id={`tariff-${typeConfig.key}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState[typeConfig.key]}
                  onChange={(event) => handleChange(typeConfig.key, event.target.value)}
                  placeholder="Ej: 17"
                  required
                />

                <p className="tariffs-preview">
                  Estimado ARS/h: {previewArs !== null ? formatArs(previewArs) : '-'}
                </p>

                <button type="submit" className="tariffs-submit" disabled={savingState[typeConfig.key]}>
                  {savingState[typeConfig.key] ? 'Guardando...' : 'Guardar tarifa'}
                </button>
              </form>

              <div className="tariffs-history-wrap">
                <h4>Historial</h4>
                {loading ? (
                  <p>Cargando...</p>
                ) : typeTariffs.length === 0 ? (
                  <p>Sin registros todavia.</p>
                ) : (
                  <div className="tariffs-table-scroll">
                    <table className="tariffs-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>USD/h</th>
                          <th>Estimado ARS/h</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeTariffs.map((tariff) => (
                          <tr key={tariff.id}>
                            <td>{formatDate(tariff.createdOn)}</td>
                            <td>{formatUsd(tariff.usdPerHour)}</td>
                            <td>
                              {typeof tariff.estimatedArsPerHour === 'number'
                                ? formatArs(tariff.estimatedArsPerHour)
                                : '-'}
                            </td>
                            <td className="tariffs-actions-cell">
                              <div className="tariffs-actions-content">
                                <button
                                  type="button"
                                  className="tariffs-row-button ui-button-with-icon"
                                  onClick={() => handleOpenEditTariff(tariff)}
                                  aria-label="Editar tarifa"
                                  title="Editar tarifa"
                                >
                                  <Pencil className="ui-button-icon" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="tariffs-row-button tariffs-row-button--danger ui-button-with-icon"
                                  onClick={() => setTariffToDelete(tariff)}
                                  aria-label="Eliminar tarifa"
                                  title="Eliminar tarifa"
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
            </article>
          )
        })}
      </div>

      <Modal
        isOpen={Boolean(editingTariff)}
        onClose={closeEditModal}
        title="Editar tarifa"
        size="sm"
        actions={
          <>
            <button type="button" className="modal-button" onClick={closeEditModal} disabled={editingSaving}>
              Cancelar
            </button>
            <button
              type="button"
              className="modal-button"
              onClick={handleUpdateTariff}
              disabled={editingSaving}
            >
              {editingSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
        isBusy={editingSaving}
      >
        <div className="tariffs-modal-field">
          <label htmlFor="tariff-edit-usd">USD por hora</label>
          <input
            id="tariff-edit-usd"
            type="number"
            min="0"
            step="0.01"
            value={editingValue}
            onChange={(event) => setEditingValue(event.target.value)}
            disabled={editingSaving}
          />
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(tariffToDelete)}
        onClose={closeDeleteModal}
        title="Eliminar tarifa"
        size="sm"
        actions={
          <>
            <button type="button" className="modal-button" onClick={closeDeleteModal} disabled={deletingTariff}>
              Cancelar
            </button>
            <button
              type="button"
              className="modal-button modal-button--danger"
              onClick={handleDeleteTariff}
              disabled={deletingTariff}
            >
              {deletingTariff ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
        isBusy={deletingTariff}
      >
        <p>
          Vas a eliminar la tarifa de{' '}
          <strong>{tariffToDelete?.type === 'diseno' ? 'diseno' : 'fabrica'}</strong> del{' '}
          <strong>{formatDate(tariffToDelete?.createdOn)}</strong>. Esta accion no se puede deshacer.
        </p>
      </Modal>
    </section>
  )
}

export default TariffsManager
