import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import Select from 'react-select'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getOfficialUsdRate } from '../../services/exchangeRate.js'
import { spanishDayPickerFormatters, spanishDayPickerLocale } from '../../utils/dayPickerEs.js'
import Modal from '../Modal/Modal.jsx'
import { appSelectStyles } from '../Select/selectStyles.js'
import './FactoryHoursManager.css'

const formatDateInput = (date) => date.toISOString().split('T')[0]

const parseDateInput = (value) => {
  if (!value) {
    return undefined
  }

  const [year, month, day] = String(value)
    .split('-')
    .map((item) => Number.parseInt(item, 10))

  if (!year || !month || !day) {
    return undefined
  }

  return new Date(year, month - 1, day)
}

const formatDateLabel = (value) => {
  const parsed = parseDateInput(value)

  if (!parsed) {
    return 'Seleccionar fecha'
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

const getMonthKey = (value) => {
  if (typeof value !== 'string' || value.length < 7) {
    return ''
  }

  return value.slice(0, 7)
}

const formatMonthLabel = (monthKey) => {
  if (!monthKey || !monthKey.includes('-')) {
    return monthKey || 'Sin mes'
  }

  const [year, month] = monthKey.split('-').map((item) => Number.parseInt(item, 10))

  if (!year || !month) {
    return monthKey
  }

  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

const formatArs = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '$ 0'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value)
}

const createInitialForm = () => ({
  date: formatDateInput(new Date()),
  factoryHours: '',
  comment: '',
  usdPerHour: '',
  tariffId: '',
  usdRate: '',
  collectionDate: '',
  paid: false,
})

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function FactoryHoursManager({ user, notify }) {
  const [records, setRecords] = useState([])
  const [formData, setFormData] = useState(createInitialForm())
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [rateLoading, setRateLoading] = useState(false)
  const [rateInfo, setRateInfo] = useState('')
  const [activeTariff, setActiveTariff] = useState(null)
  const [tariffLoading, setTariffLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('all')
  const [collectionMonthFilter, setCollectionMonthFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [openDatePicker, setOpenDatePicker] = useState(null)
  const [datePopoverStyle, setDatePopoverStyle] = useState(null)
  const hasFactoryHours = toNumber(formData.factoryHours) !== null
  const hasUsdPerHour = toNumber(formData.usdPerHour) !== null
  const isTariffBlocked = !tariffLoading && !hasUsdPerHour
  const dateTriggerRefs = useRef({})

  const calculatedTotalArs = useMemo(() => {
    const hours = toNumber(formData.factoryHours)
    const usdPerHour = toNumber(formData.usdPerHour)
    const usdRate = toNumber(formData.usdRate)

    if (hours === null || usdPerHour === null || usdRate === null) {
      return ''
    }

    return Number((hours * usdPerHour * usdRate).toFixed(2)).toString()
  }, [formData.factoryHours, formData.usdPerHour, formData.usdRate])

  const availableMonths = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        records
          .map((record) => getMonthKey(record.date))
          .filter(Boolean),
      ),
    )

    uniqueMonths.sort((a, b) => (a < b ? 1 : -1))
    return uniqueMonths
  }, [records])

  const availableCollectionMonths = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        records
          .map((record) => getMonthKey(record.collectionDate))
          .filter(Boolean),
      ),
    )

    uniqueMonths.sort((a, b) => (a < b ? 1 : -1))
    return uniqueMonths
  }, [records])

  const monthFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      ...availableMonths.map((monthKey) => ({
        value: monthKey,
        label: formatMonthLabel(monthKey),
      })),
    ]
  }, [availableMonths])

  const collectionMonthFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      ...availableCollectionMonths.map((monthKey) => ({
        value: monthKey,
        label: formatMonthLabel(monthKey),
      })),
    ]
  }, [availableCollectionMonths])

  const paymentFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      { value: 'paid', label: 'Cobrados' },
      { value: 'pending', label: 'Pendientes' },
    ]
  }, [])

  const hasBillingData = useMemo(() => {
    const hours = toNumber(formData.factoryHours)
    const total = toNumber(calculatedTotalArs)
    return hours !== null && total !== null
  }, [calculatedTotalArs, formData.factoryHours])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (monthFilter !== 'all' && getMonthKey(record.date) !== monthFilter) {
        return false
      }

      if (
        collectionMonthFilter !== 'all' &&
        getMonthKey(record.collectionDate) !== collectionMonthFilter
      ) {
        return false
      }

      if (paymentFilter === 'paid' && !record.paid) {
        return false
      }

      if (paymentFilter === 'pending' && record.paid) {
        return false
      }

      return true
    })
  }, [collectionMonthFilter, monthFilter, paymentFilter, records])

  const recordsSummary = useMemo(() => {
    return filteredRecords.reduce(
      (accumulator, record) => {
        if (typeof record.factoryHours === 'number') {
          accumulator.hours += record.factoryHours
        }

        if (typeof record.totalArs === 'number') {
          accumulator.total += record.totalArs

          if (record.paid) {
            accumulator.collected += record.totalArs
          } else {
            accumulator.pending += record.totalArs
          }
        }

        return accumulator
      },
      {
        hours: 0,
        total: 0,
        collected: 0,
        pending: 0,
      },
    )
  }, [filteredRecords])

  const loadRecords = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const recordsRef = collection(db, 'factoryHours')
      const recordsQuery = query(recordsRef, where('userId', '==', user.uid))
      const snapshot = await getDocs(recordsQuery)

      const loadedRecords = snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          ...data,
        }
      })

      loadedRecords.sort((a, b) => {
        const dateA = a.date || ''
        const dateB = b.date || ''
        return dateA < dateB ? 1 : -1
      })

      setRecords(loadedRecords)
    } catch (error) {
      console.error('Error al cargar horas de fabrica:', error)
      setErrorMessage('No se pudieron cargar los registros de horas fabrica.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [user.uid])

  useEffect(() => {
    setTariffLoading(true)

    const tariffsRef = collection(db, 'tariffs')
    const tariffsQuery = query(
      tariffsRef,
      where('userId', '==', user.uid),
      where('type', '==', 'fabrica'),
    )

    const unsubscribe = onSnapshot(
      tariffsQuery,
      (snapshot) => {
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

        setActiveTariff(loadedTariffs[0] || null)
        setTariffLoading(false)
      },
      (error) => {
        console.error('Error al cargar tarifa vigente de fabrica:', error)
        setActiveTariff(null)
        setTariffLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user.uid])

  useEffect(() => {
    if (!isFormOpen || editingRecordId) {
      return
    }

    setFormData((current) => ({
      ...current,
      usdPerHour: activeTariff?.usdPerHour ? String(activeTariff.usdPerHour) : '',
      tariffId: activeTariff?.id || '',
    }))
  }, [activeTariff, editingRecordId, isFormOpen])

  useEffect(() => {
    if (!hasBillingData && (formData.paid || formData.collectionDate)) {
      setFormData((current) => ({
        ...current,
        paid: false,
        collectionDate: '',
      }))
    }
  }, [formData.collectionDate, formData.paid, hasBillingData])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    if (name === 'paid') {
      setFormData((current) => ({
        ...current,
        paid: checked,
        collectionDate: checked ? current.collectionDate : '',
      }))
      return
    }

    if (name === 'factoryHours') {
      setFormData((current) => ({
        ...current,
        factoryHours: value,
        usdRate: value === '' ? '' : current.usdRate,
      }))

      if (value === '') {
        setRateInfo('')
      }

      return
    }

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const resetForm = () => {
    setFormData(createInitialForm())
    setEditingRecordId(null)
  }

  const closeForm = () => {
    resetForm()
    setIsFormOpen(false)
    setOpenDatePicker(null)
    setDatePopoverStyle(null)
  }

  const closeDeleteModal = () => {
    setRecordToDelete(null)
  }

  const handleOpenCreateForm = () => {
    resetForm()
    setErrorMessage('')
    setIsFormOpen(true)
    setOpenDatePicker(null)
  }

  const handleDateSelection = (fieldName, date) => {
    if (!date) {
      return
    }

    setFormData((current) => ({
      ...current,
      [fieldName]: formatDateInput(date),
    }))
    setOpenDatePicker(null)
    setDatePopoverStyle(null)
  }

  useEffect(() => {
    if (!openDatePicker) {
      setDatePopoverStyle(null)
      return undefined
    }

    const updatePopoverPosition = () => {
      const trigger = dateTriggerRefs.current[openDatePicker]

      if (!trigger) {
        setDatePopoverStyle(null)
        return
      }

      const rect = trigger.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const preferredWidth = Math.min(320, viewportWidth - 20)
      const horizontalSpaceRight = viewportWidth - rect.left
      const left = Math.max(10, Math.min(rect.left, viewportWidth - preferredWidth - 10))
      const spaceBelow = viewportHeight - rect.bottom
      const estimatedHeight = 360
      const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight

      setDatePopoverStyle({
        top: openAbove ? Math.max(10, rect.top - estimatedHeight - 8) : rect.bottom + 8,
        left,
        width: Math.max(280, Math.min(preferredWidth, horizontalSpaceRight - 10)),
        placement: openAbove ? 'top' : 'bottom',
      })
    }

    updatePopoverPosition()

    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)

    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [openDatePicker])

  useEffect(() => {
    if (!openDatePicker) {
      return
    }

    const handleDocumentPointerDown = (event) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (!target.closest('.factory-date-field') && !target.closest('.factory-date-popover')) {
        setOpenDatePicker(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenDatePicker(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openDatePicker])

  const loadUsdRate = async () => {
    if (!hasFactoryHours) {
      setRateInfo('Carga horas de fabrica para autocompletar la cotizacion.')
      return
    }

    setRateLoading(true)

    try {
      const result = await getOfficialUsdRate()

      setFormData((current) => ({
        ...current,
        usdRate: String(result.rate),
      }))

      setRateInfo('Cotizacion cargada automaticamente desde DolarAPI.')
    } catch (error) {
      console.error('Error al obtener cotizacion:', error)
      setRateInfo('No se pudo autocompletar la cotizacion. Puedes cargarla manualmente.')
    } finally {
      setRateLoading(false)
    }
  }

  useEffect(() => {
    if (hasFactoryHours && !formData.usdRate) {
      loadUsdRate()
    }
  }, [hasFactoryHours, formData.usdRate])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.date) {
      setErrorMessage('Debes seleccionar una fecha para el registro de horas.')
      return
    }

    if (formData.paid && !formData.collectionDate) {
      setErrorMessage('Debes completar la fecha de cobro cuando el pago esta marcado.')
      return
    }

    if (isTariffBlocked) {
      setErrorMessage('No se puede crear el registro: primero debes cargar una tarifa vigente de fabrica.')
      notify?.({
        message: 'No hay tarifa vigente de fabrica. Cargala en el modulo Tarifas.',
        tone: 'error',
      })
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const factoryHours = toNumber(formData.factoryHours)
      const usdPerHour = toNumber(formData.usdPerHour)
      const usdRate = toNumber(formData.usdRate)
      const totalArs =
        factoryHours !== null && usdPerHour !== null && usdRate !== null
          ? Number((factoryHours * usdPerHour * usdRate).toFixed(2))
          : null

      const payload = {
        date: formData.date,
        factoryHours,
        comment: formData.comment.trim(),
        usdPerHour,
        tariffId: formData.tariffId || null,
        usdRate,
        totalArs,
        collectionDate: formData.collectionDate || null,
        paid: Boolean(formData.paid),
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
      }

      if (editingRecordId) {
        await updateDoc(doc(db, 'factoryHours', editingRecordId), payload)
        notify?.({
          message: `Se ha modificado el registro del ${payload.date} correctamente.`,
          tone: 'success',
        })
      } else {
        await addDoc(collection(db, 'factoryHours'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        notify?.({
          message: `Se ha creado el registro de horas del ${payload.date} satisfactoriamente.`,
          tone: 'success',
        })
      }

      await loadRecords()
      closeForm()
    } catch (error) {
      console.error('Error al guardar horas de fabrica:', error)
      setErrorMessage('No se pudo guardar el registro de horas fabrica.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (record) => {
    setEditingRecordId(record.id)
    setIsFormOpen(true)
    setErrorMessage('')
    setFormData({
      date: record.date || formatDateInput(new Date()),
      factoryHours:
        record.factoryHours === null || record.factoryHours === undefined
          ? ''
          : String(record.factoryHours),
      comment: record.comment || '',
      usdPerHour:
        record.usdPerHour === null || record.usdPerHour === undefined
          ? activeTariff?.usdPerHour
            ? String(activeTariff.usdPerHour)
            : ''
          : String(record.usdPerHour),
      tariffId: record.tariffId || activeTariff?.id || '',
      usdRate:
        record.usdRate === null || record.usdRate === undefined
          ? ''
          : String(record.usdRate),
      collectionDate: record.collectionDate || '',
      paid: Boolean(record.paid),
    })
    setOpenDatePicker(null)
  }

  const handleDelete = async () => {
    if (!recordToDelete) {
      return
    }

    setDeleting(true)

    try {
      const deletedDate = recordToDelete.date || 'fecha seleccionada'
      await deleteDoc(doc(db, 'factoryHours', recordToDelete.id))

      if (editingRecordId === recordToDelete.id) {
        closeForm()
      }

      await loadRecords()
      closeDeleteModal()
      notify?.({
        message: `Se ha eliminado el registro del ${deletedDate} correctamente.`,
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al eliminar horas de fabrica:', error)
      setErrorMessage('No se pudo eliminar el registro de horas fabrica.')
      notify?.({
        message: 'No se pudo eliminar el registro de horas fabrica.',
        tone: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  const setDateTriggerRef = (fieldName) => (node) => {
    if (node) {
      dateTriggerRefs.current[fieldName] = node
      return
    }

    delete dateTriggerRefs.current[fieldName]
  }

  const renderDatePopover = (fieldName, ariaLabel, selectedDate, onSelect) => {
    if (openDatePicker !== fieldName || !datePopoverStyle) {
      return null
    }

    return createPortal(
      <div
        className="factory-date-popover"
        role="dialog"
        aria-label={ariaLabel}
        style={{
          top: `${datePopoverStyle.top}px`,
          left: `${datePopoverStyle.left}px`,
          width: `${datePopoverStyle.width}px`,
        }}
        data-placement={datePopoverStyle.placement || 'bottom'}
      >
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={onSelect}
          locale={spanishDayPickerLocale}
          formatters={spanishDayPickerFormatters}
          className="factory-day-picker"
          showOutsideDays
        />
      </div>,
      document.body,
    )
  }

  return (
    <section className="factory-hours-manager" aria-label="ABM horas fabrica">
      <div className="factory-hours-header">
        <h2>Horas fabrica</h2>
        <div className="factory-hours-actions">
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="factory-hours-action factory-hours-action--primary ui-button-with-icon"
            data-tour="factory-hours-create-button"
          >
            <Plus className="ui-button-icon" aria-hidden="true" />
            Horas
          </button>
        </div>
      </div>

      <div className="factory-hours-list-wrap">
        <div className="factory-hours-list-head">
          <h3>Listado de horas</h3>
          <button
            type="button"
            className="factory-hours-filters-toggle ui-button-with-icon"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="factory-hours-filters-panel"
          >
            {showFilters ? (
              <EyeOff className="ui-button-icon" aria-hidden="true" />
            ) : (
              <Eye className="ui-button-icon" aria-hidden="true" />
            )}
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>
        {showFilters ? (
          <div id="factory-hours-filters-panel" className="factory-hours-filters" aria-label="Filtros de horas fabrica">
            <label className="factory-hours-filter-field" htmlFor="factory-hours-filter-month">
              Mes
              <Select
                inputId="factory-hours-filter-month"
                classNamePrefix="factory-hours-select"
                isSearchable={false}
                options={monthFilterOptions}
                value={monthFilterOptions.find((option) => option.value === monthFilter)}
                onChange={(option) => setMonthFilter(option?.value || 'all')}
                styles={appSelectStyles}
              />
            </label>

            <label className="factory-hours-filter-field" htmlFor="factory-hours-filter-collection-month">
              Mes de cobro
              <Select
                inputId="factory-hours-filter-collection-month"
                classNamePrefix="factory-hours-select"
                isSearchable={false}
                options={collectionMonthFilterOptions}
                value={collectionMonthFilterOptions.find((option) => option.value === collectionMonthFilter)}
                onChange={(option) => setCollectionMonthFilter(option?.value || 'all')}
                styles={appSelectStyles}
              />
            </label>

            <label className="factory-hours-filter-field" htmlFor="factory-hours-filter-payment">
              Pago
              <Select
                inputId="factory-hours-filter-payment"
                classNamePrefix="factory-hours-select"
                isSearchable={false}
                options={paymentFilterOptions}
                value={paymentFilterOptions.find((option) => option.value === paymentFilter)}
                onChange={(option) => setPaymentFilter(option?.value || 'all')}
                styles={appSelectStyles}
              />
            </label>
          </div>
        ) : null}

        {showFilters ? (
          <div className="factory-hours-summary" aria-label="Resumen de horas fabrica filtradas">
            <article className="factory-hours-summary-card">
              <p>Registros filtrados</p>
              <strong>{filteredRecords.length}</strong>
            </article>
            <article className="factory-hours-summary-card">
              <p>Horas totales</p>
              <strong>{recordsSummary.hours.toFixed(2)}</strong>
            </article>
            <article className="factory-hours-summary-card">
              <p>Costo total</p>
              <strong>{formatArs(recordsSummary.total)}</strong>
            </article>
            <article className="factory-hours-summary-card">
              <p>Cobrado</p>
              <strong>{formatArs(recordsSummary.collected)}</strong>
            </article>
            <article className="factory-hours-summary-card">
              <p>Pendiente</p>
              <strong>{formatArs(recordsSummary.pending)}</strong>
            </article>
          </div>
        ) : null}

        {loading ? (
          <p>Cargando registros...</p>
        ) : records.length === 0 ? (
          <p>No hay registros cargados.</p>
        ) : filteredRecords.length === 0 ? (
          <p>No hay registros que coincidan con el mes seleccionado.</p>
        ) : (
          <div className="factory-hours-table-scroll" data-tour="factory-hours-table">
            <table className="factory-hours-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hs fabrica</th>
                  <th>Total Ars</th>
                  <th>Pago</th>
                  <th>Comentario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date || '-'}</td>
                    <td>{record.factoryHours ?? '-'}</td>
                    <td>{record.totalArs ?? '-'}</td>
                    <td>{record.paid ? 'Si' : 'No'}</td>
                    <td>{record.comment || '-'}</td>
                    <td className="factory-hours-actions-cell">
                      <div className="factory-hours-actions-content">
                        <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          className="factory-hours-row-button ui-button-with-icon"
                          aria-label="Editar registro"
                          title="Editar registro"
                        >
                          <Pencil className="ui-button-icon" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(record)}
                          className="factory-hours-row-button factory-hours-row-button--danger ui-button-with-icon"
                          aria-label="Eliminar registro"
                          title="Eliminar registro"
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
        title={editingRecordId ? 'Editar horas fabrica' : 'Nuevo registro de horas'}
        isBusy={saving}
      >
        <form className="factory-hours-form factory-hours-form--modal" onSubmit={handleSubmit}>
          {!tariffLoading && !hasUsdPerHour ? (
            <p className="factory-hours-error" role="alert">
              No puedes crear horas de fabrica porque no hay tarifa vigente de fabrica.
              Ve al modulo Tarifas y carga una.
            </p>
          ) : null}

          <div className="factory-field">
            <label htmlFor="factory-date">Fecha</label>
            <div className="factory-date-field">
              <button
                id="factory-date"
                type="button"
                className={`factory-date-trigger${formData.date ? '' : ' factory-date-trigger--empty'}`}
                onClick={() => setOpenDatePicker((current) => (current === 'date' ? null : 'date'))}
                aria-haspopup="dialog"
                aria-expanded={openDatePicker === 'date'}
                ref={setDateTriggerRef('date')}
              >
                {formatDateLabel(formData.date)}
                <CalendarDays className="factory-date-trigger-icon" aria-hidden="true" />
              </button>
              {renderDatePopover(
                'date',
                'Seleccionar fecha',
                parseDateInput(formData.date),
                (date) => handleDateSelection('date', date),
              )}
            </div>
          </div>

          <div className="factory-field">
            <label htmlFor="factory-hours">Hs fabrica</label>
            <input
              id="factory-hours"
              name="factoryHours"
              type="number"
              min="0"
              step="0.5"
              value={formData.factoryHours}
              onChange={handleChange}
              disabled={isTariffBlocked}
              required
            />
          </div>

          <div className="factory-field factory-field--full">
            <label htmlFor="factory-comment">Comentario</label>
            <input
              id="factory-comment"
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              placeholder="Opcional"
              disabled={isTariffBlocked}
            />
          </div>

          <div className="factory-field">
            <label htmlFor="factory-usd-hourly-rate">Tarifa vigente (USD/h)</label>
            <input
              id="factory-usd-hourly-rate"
              name="usdPerHour"
              type="number"
              value={formData.usdPerHour}
              readOnly
              placeholder="Se toma desde Tarifas"
            />
            <p className="factory-rate-info factory-rate-info--hint">
              Se toma automaticamente la tarifa vigente de fabrica.
            </p>
          </div>

          <div className="factory-field">
            <label htmlFor="factory-usd-rate">Cotizacion dolar</label>
            <div className="factory-rate-field">
              <input
                id="factory-usd-rate"
                name="usdRate"
                type="number"
                min="0"
                step="0.01"
                value={formData.usdRate}
                onChange={handleChange}
                placeholder="Ej: 1450"
                disabled={isTariffBlocked || !hasFactoryHours}
                required={hasFactoryHours && hasUsdPerHour}
              />
              <button
                type="button"
                onClick={loadUsdRate}
                className="factory-rate-refresh"
                disabled={isTariffBlocked || rateLoading || !hasFactoryHours}
              >
                {rateLoading ? 'Cargando...' : 'Autocompletar'}
              </button>
            </div>
            {rateInfo ? (
              <p className="factory-rate-info">{rateInfo}</p>
            ) : (
              <p className="factory-rate-info factory-rate-info--hint">
                La cotizacion se autocompleta cuando cargas horas de fabrica.
              </p>
            )}
          </div>

          <div className="factory-field">
            <label htmlFor="factory-total-ars">Total ARS (horas x usd/h x cotizacion)</label>
            <input
              id="factory-total-ars"
              name="totalArs"
              value={calculatedTotalArs}
              readOnly
              placeholder="Se calcula automaticamente"
            />
          </div>

          <section className="factory-payment" aria-label="Estado de cobro horas fabrica">
            <h3>Cobro</h3>

            {!hasBillingData ? (
              <p className="factory-rate-info factory-rate-info--hint">
                Completa horas y total para habilitar el estado de cobro.
              </p>
            ) : null}

            <label className="factory-paid" htmlFor="factory-paid">
              <input
                id="factory-paid"
                name="paid"
                type="checkbox"
                checked={formData.paid}
                onChange={handleChange}
                disabled={isTariffBlocked || !hasBillingData}
              />
              Pago recibido
            </label>

            <div className="factory-field">
              <label htmlFor="factory-collection-date">Fecha de cobro</label>
              <div className="factory-date-field">
                <button
                  id="factory-collection-date"
                  type="button"
                  className={`factory-date-trigger${formData.collectionDate ? '' : ' factory-date-trigger--empty'}`}
                  onClick={() => setOpenDatePicker((current) => (current === 'collectionDate' ? null : 'collectionDate'))}
                  disabled={isTariffBlocked || !hasBillingData || !formData.paid}
                  aria-haspopup="dialog"
                  aria-expanded={openDatePicker === 'collectionDate'}
                  ref={setDateTriggerRef('collectionDate')}
                >
                  {formatDateLabel(formData.collectionDate)}
                  <CalendarDays className="factory-date-trigger-icon" aria-hidden="true" />
                </button>
                {renderDatePopover(
                  'collectionDate',
                  'Seleccionar fecha de cobro',
                  parseDateInput(formData.collectionDate),
                  (date) => handleDateSelection('collectionDate', date),
                )}
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="factory-hours-submit"
            disabled={saving || isTariffBlocked}
          >
            {saving
              ? <span className="ui-inline-loader">Guardando...</span>
              : editingRecordId
                ? 'Actualizar registro'
                : 'Crear registro'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(recordToDelete)}
        onClose={closeDeleteModal}
        title="Eliminar registro"
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
          Vas a eliminar el registro del dia{' '}
          <strong>{recordToDelete?.date || 'seleccionado'}</strong>. Esta accion no se
          puede deshacer.
        </p>
      </Modal>

      {errorMessage ? <p className="factory-hours-error">{errorMessage}</p> : null}
    </section>
  )
}

export default FactoryHoursManager