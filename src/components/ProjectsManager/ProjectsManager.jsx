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
import './ProjectsManager.css'

const PROJECT_STATUSES = [
  { value: 'no iniciado', label: 'No iniciado' },
  { value: 'iniciado', label: 'Iniciado' },
  { value: 'stand by', label: 'Stand by' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'urgente', label: 'Urgente' },
]

const DEFAULT_PROJECT_STATUS = 'no iniciado'

const normalizeProjectStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  const isValid = PROJECT_STATUSES.some((item) => item.value === normalized)

  return isValid ? normalized : DEFAULT_PROJECT_STATUS
}

const getProjectStatusLabel = (status) => {
  const normalized = normalizeProjectStatus(status)
  return PROJECT_STATUSES.find((item) => item.value === normalized)?.label || 'No iniciado'
}

const formatDateInput = (date) => {
  return date.toISOString().split('T')[0]
}

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
  clientId: '',
  name: '',
  status: DEFAULT_PROJECT_STATUS,
  startDate: formatDateInput(new Date()),
  deliveryDate: '',
  finalHours: '',
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

const normalizeProject = (project) => {
  const finalHours = toNumber(project.finalHours)
  const usdPerHour = toNumber(project.usdPerHour)
  const usdRate = toNumber(project.usdRate)
  const total =
    finalHours !== null && usdPerHour !== null && usdRate !== null
      ? Number((finalHours * usdPerHour * usdRate).toFixed(2))
      : finalHours !== null && usdRate !== null
        ? Number((finalHours * usdRate).toFixed(2))
      : null

  return {
    ...project,
    status: normalizeProjectStatus(project.status),
    finalHours,
    usdPerHour,
    usdRate,
    total,
  }
}

function ProjectsManager({ user, notify }) {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [formData, setFormData] = useState(createInitialForm())
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [rateLoading, setRateLoading] = useState(false)
  const [rateInfo, setRateInfo] = useState('')
  const [activeTariff, setActiveTariff] = useState(null)
  const [tariffLoading, setTariffLoading] = useState(true)
  const [openDatePicker, setOpenDatePicker] = useState(null)
  const [datePopoverStyle, setDatePopoverStyle] = useState(null)
  const [startMonthFilter, setStartMonthFilter] = useState('all')
  const [collectionMonthFilter, setCollectionMonthFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const todayDate = formatDateInput(new Date())
  const todayDateObject = parseDateInput(todayDate)
  const hasFinalHours = toNumber(formData.finalHours) !== null
  const hasUsdPerHour = toNumber(formData.usdPerHour) !== null
  const isCompletedStatus = formData.status === 'finalizado'
  const isCreateMode = !editingProjectId
  const hasClients = clients.length > 0
  const isCreateBlocked = isCreateMode && !clientsLoading && !hasClients
  const isTariffBlocked = !tariffLoading && !hasUsdPerHour
  const dateTriggerRefs = useRef({})

  const calculatedTotal = useMemo(() => {
    const finalHours = toNumber(formData.finalHours)
    const usdPerHour = toNumber(formData.usdPerHour)
    const usdRate = toNumber(formData.usdRate)

    if (finalHours === null || usdPerHour === null || usdRate === null) {
      return ''
    }

    return Number((finalHours * usdPerHour * usdRate).toFixed(2)).toString()
  }, [formData.finalHours, formData.usdPerHour, formData.usdRate])

  const hasClosingData = useMemo(() => {
    const finalHours = toNumber(formData.finalHours)
    const total = toNumber(calculatedTotal)
    return finalHours !== null && total !== null
  }, [calculatedTotal, formData.finalHours])

  const clientsById = useMemo(() => {
    return clients.reduce((accumulator, client) => {
      accumulator[client.id] = client
      return accumulator
    }, {})
  }, [clients])

  const availableCollectionMonths = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        projects
          .map((project) => getMonthKey(project.collectionDate))
          .filter(Boolean),
      ),
    )

    uniqueMonths.sort((a, b) => (a < b ? 1 : -1))
    return uniqueMonths
  }, [projects])

  const availableStartMonths = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        projects
          .map((project) => getMonthKey(project.startDate))
          .filter(Boolean),
      ),
    )

    uniqueMonths.sort((a, b) => (a < b ? 1 : -1))
    return uniqueMonths
  }, [projects])

  const startMonthFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      ...availableStartMonths.map((monthKey) => ({
        value: monthKey,
        label: formatMonthLabel(monthKey),
      })),
    ]
  }, [availableStartMonths])

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

  const statusFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      ...PROJECT_STATUSES.map((status) => ({
        value: status.value,
        label: status.label,
      })),
    ]
  }, [])

  const clientFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todos' },
      ...clients.map((client) => ({
        value: client.id,
        label: client.company,
      })),
    ]
  }, [clients])

  const statusFormOptions = useMemo(() => {
    return PROJECT_STATUSES
  }, [])

  const clientFormOptions = useMemo(() => {
    return clients.map((client) => ({
      value: client.id,
      label: `${client.company} - ${client.name}`,
    }))
  }, [clients])

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (startMonthFilter !== 'all') {
        const projectStartMonth = getMonthKey(project.startDate)

        if (projectStartMonth !== startMonthFilter) {
          return false
        }
      }

      if (collectionMonthFilter !== 'all') {
        const projectMonth = getMonthKey(project.collectionDate)

        if (projectMonth !== collectionMonthFilter) {
          return false
        }
      }

      if (paymentFilter === 'paid' && !project.paid) {
        return false
      }

      if (paymentFilter === 'pending' && project.paid) {
        return false
      }

      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false
      }

      if (clientFilter !== 'all' && project.clientId !== clientFilter) {
        return false
      }

      return true
    })
  }, [clientFilter, collectionMonthFilter, paymentFilter, projects, startMonthFilter, statusFilter])

  const projectTotals = useMemo(() => {
    return filteredProjects.reduce(
      (accumulator, project) => {
        const total = typeof project.total === 'number' ? project.total : 0

        if (typeof project.total === 'number') {
          accumulator.total += total
        }

        if (project.paid) {
          accumulator.collected += total
        } else {
          accumulator.pending += total
        }

        return accumulator
      },
      {
        total: 0,
        collected: 0,
        pending: 0,
      },
    )
  }, [filteredProjects])

  const loadProjects = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const projectsRef = collection(db, 'projects')
      const projectsQuery = query(projectsRef, where('userId', '==', user.uid))
      const snapshot = await getDocs(projectsQuery)

      const loadedProjects = snapshot.docs.map((item) => {
        const data = item.data()

        return normalizeProject({
          id: item.id,
          ...data,
        })
      })

      loadedProjects.sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
      setProjects(loadedProjects)
    } catch (error) {
      console.error('Error al cargar proyectos:', error)
      setErrorMessage('No se pudieron cargar los proyectos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [user.uid])

  const loadClients = async () => {
    setClientsLoading(true)

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
      setErrorMessage('No se pudieron cargar los clientes para el formulario.')
    } finally {
      setClientsLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [user.uid])

  useEffect(() => {
    setTariffLoading(true)

    const tariffsRef = collection(db, 'tariffs')
    const tariffsQuery = query(
      tariffsRef,
      where('userId', '==', user.uid),
      where('type', '==', 'diseno'),
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
        console.error('Error al cargar tarifa vigente de diseno:', error)
        setActiveTariff(null)
        setTariffLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user.uid])

  useEffect(() => {
    if (!isFormOpen || editingProjectId) {
      return
    }

    setFormData((current) => ({
      ...current,
      usdPerHour: activeTariff?.usdPerHour ? String(activeTariff.usdPerHour) : '',
      tariffId: activeTariff?.id || '',
    }))
  }, [activeTariff, editingProjectId, isFormOpen])

  const generateProjectCode = (nextSequence, startDate) => {
    const projectDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
    const yearSuffix = String(projectDate.getFullYear()).slice(-2)
    const sequencePart = String(nextSequence).padStart(2, '0')

    return `P-${sequencePart}-${yearSuffix}`
  }

  const resetForm = () => {
    setFormData(createInitialForm())
    setEditingProjectId(null)
  }

  const closeForm = () => {
    resetForm()
    setIsFormOpen(false)
    setOpenDatePicker(null)
    setDatePopoverStyle(null)
    setErrorMessage('')
  }

  const closeDeleteModal = () => {
    setProjectToDelete(null)
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

      if (!target.closest('.projects-date-field') && !target.closest('.projects-date-popover')) {
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
    if (!hasFinalHours) {
      setRateInfo('Carga horas finales para autocompletar la cotizacion.')
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
    if (hasFinalHours && !formData.usdRate) {
      loadUsdRate()
    }
  }, [hasFinalHours, formData.usdRate])

  useEffect(() => {
    if (!hasClosingData && (formData.paid || formData.collectionDate)) {
      setFormData((current) => ({
        ...current,
        paid: false,
        collectionDate: '',
      }))
    }
  }, [formData.collectionDate, formData.paid, hasClosingData])

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

    if (name === 'finalHours') {
      setFormData((current) => ({
        ...current,
        finalHours: value,
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

  const handleSelectFieldChange = (fieldName, selectedOption) => {
    setFormData((current) => ({
      ...current,
      [fieldName]: selectedOption?.value || '',
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.clientId) {
      setErrorMessage('Debes seleccionar un cliente para el proyecto.')
      return
    }

    if (!formData.startDate || !formData.deliveryDate) {
      setErrorMessage('Debes completar fecha de inicio y fecha estimada de entrega.')
      return
    }

    if (formData.paid && !formData.collectionDate) {
      setErrorMessage('Debes completar la fecha de cobro cuando el pago esta marcado.')
      return
    }

    if (isCreateBlocked) {
      setErrorMessage('No se puede crear el proyecto: primero debes cargar al menos un cliente.')
      notify?.({
        message: 'No se puede crear el proyecto sin clientes. Crea un cliente primero.',
        tone: 'error',
      })
      return
    }

    if (isTariffBlocked) {
      setErrorMessage('No se puede crear el proyecto: primero debes cargar una tarifa vigente de diseno.')
      notify?.({
        message: 'No hay tarifa vigente de diseno. Cargala en el modulo Tarifas.',
        tone: 'error',
      })
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const finalHours = toNumber(formData.finalHours)
      const usdPerHour = toNumber(formData.usdPerHour)
      const usdRate = toNumber(formData.usdRate)
      const total =
        finalHours !== null && usdPerHour !== null && usdRate !== null
          ? Number((finalHours * usdPerHour * usdRate).toFixed(2))
          : null

      const projectPayload = {
        clientId: formData.clientId,
        name: formData.name.trim(),
        status: normalizeProjectStatus(formData.status),
        startDate: formData.startDate,
        deliveryDate: formData.deliveryDate || null,
        finalHours,
        usdPerHour,
        tariffId: formData.tariffId || null,
        usdRate,
        total,
        collectionDate: formData.collectionDate || null,
        paid: Boolean(formData.paid),
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
      }

      if (editingProjectId) {
        const projectRef = doc(db, 'projects', editingProjectId)
        await updateDoc(projectRef, projectPayload)
        notify?.({
          message: `Se ha modificado el proyecto "${projectPayload.name}" correctamente.`,
          tone: 'success',
        })
      } else {
        const highestSequence = projects.reduce((max, project) => {
          const current = project.sequence || 0
          return current > max ? current : max
        }, 0)
        const nextSequence = highestSequence + 1

        await addDoc(collection(db, 'projects'), {
          ...projectPayload,
          sequence: nextSequence,
          code: generateProjectCode(nextSequence, formData.startDate),
          createdAt: serverTimestamp(),
        })
        notify?.({
          message: `Se ha creado el proyecto "${projectPayload.name}" satisfactoriamente.`,
          tone: 'success',
        })
      }

      await loadProjects()
      closeForm()
    } catch (error) {
      console.error('Error al guardar proyecto:', error)
      setErrorMessage('No se pudo guardar el proyecto.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (project) => {
    setEditingProjectId(project.id)
    setIsFormOpen(true)
    setErrorMessage('')
    setFormData({
      clientId: project.clientId || '',
      name: project.name || '',
      status: normalizeProjectStatus(project.status),
      startDate: project.startDate || formatDateInput(new Date()),
      deliveryDate: project.deliveryDate || '',
      finalHours:
        project.finalHours === null || project.finalHours === undefined
          ? ''
          : String(project.finalHours),
      usdPerHour:
        project.usdPerHour === null || project.usdPerHour === undefined
          ? activeTariff?.usdPerHour
            ? String(activeTariff.usdPerHour)
            : ''
          : String(project.usdPerHour),
      tariffId: project.tariffId || activeTariff?.id || '',
      usdRate:
        project.usdRate === null || project.usdRate === undefined
          ? ''
          : String(project.usdRate),
      collectionDate: project.collectionDate || '',
      paid: Boolean(project.paid),
    })
  }

  const setDateTriggerRef = (fieldName) => (node) => {
    if (node) {
      dateTriggerRefs.current[fieldName] = node
      return
    }

    delete dateTriggerRefs.current[fieldName]
  }

  const renderDatePopover = (fieldName, ariaLabel, selectedDate, onSelect, disabled) => {
    if (openDatePicker !== fieldName || !datePopoverStyle) {
      return null
    }

    return createPortal(
      <div
        className="projects-date-popover"
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
          disabled={disabled}
          locale={spanishDayPickerLocale}
          formatters={spanishDayPickerFormatters}
          className="projects-day-picker"
          showOutsideDays
        />
      </div>,
      document.body,
    )
  }

  const handleDelete = async () => {
    if (!projectToDelete) {
      return
    }

    setDeleting(true)

    try {
      const deletedName = projectToDelete.name || 'proyecto'
      await deleteDoc(doc(db, 'projects', projectToDelete.id))

      if (editingProjectId === projectToDelete.id) {
        closeForm()
      }

      await loadProjects()
      closeDeleteModal()
      notify?.({
        message: `Se ha eliminado el proyecto "${deletedName}" correctamente.`,
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al eliminar proyecto:', error)
      setErrorMessage('No se pudo eliminar el proyecto.')
      notify?.({
        message: 'No se pudo eliminar el proyecto.',
        tone: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="projects-manager" aria-label="ABM de proyectos">
      <div className="projects-manager-header">
        <h2>Proyectos</h2>
        <div className="projects-manager-actions">
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="projects-action projects-action--primary ui-button-with-icon"
            data-tour="projects-create-button"
          >
            <Plus className="ui-button-icon" aria-hidden="true" />
            Proyecto
          </button>
        </div>
      </div>

      <div className="projects-list-wrap">
        <div className="projects-list-head">
          <h3>Listado de proyectos</h3>
          <button
            type="button"
            className="projects-filters-toggle ui-button-with-icon"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="projects-filters-panel"
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
          <div id="projects-filters-panel" className="projects-filters" aria-label="Filtros de proyectos">
          <label className="projects-filter-field" htmlFor="projects-filter-start-month">
            Mes de inicio
            <Select
              inputId="projects-filter-start-month"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={startMonthFilterOptions}
              value={startMonthFilterOptions.find((option) => option.value === startMonthFilter)}
              onChange={(option) => setStartMonthFilter(option?.value || 'all')}
              styles={appSelectStyles}
            />
          </label>

          <label className="projects-filter-field" htmlFor="projects-filter-month">
            Mes de cobro
            <Select
              inputId="projects-filter-month"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={collectionMonthFilterOptions}
              value={collectionMonthFilterOptions.find((option) => option.value === collectionMonthFilter)}
              onChange={(option) => setCollectionMonthFilter(option?.value || 'all')}
              styles={appSelectStyles}
            />
          </label>

          <label className="projects-filter-field" htmlFor="projects-filter-payment">
            Pago
            <Select
              inputId="projects-filter-payment"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={paymentFilterOptions}
              value={paymentFilterOptions.find((option) => option.value === paymentFilter)}
              onChange={(option) => setPaymentFilter(option?.value || 'all')}
              styles={appSelectStyles}
            />
          </label>

          <label className="projects-filter-field" htmlFor="projects-filter-status">
            Estado
            <Select
              inputId="projects-filter-status"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={statusFilterOptions}
              value={statusFilterOptions.find((option) => option.value === statusFilter)}
              onChange={(option) => setStatusFilter(option?.value || 'all')}
              styles={appSelectStyles}
            />
          </label>

          <label className="projects-filter-field" htmlFor="projects-filter-client">
            Cliente
            <Select
              inputId="projects-filter-client"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={clientFilterOptions}
              value={clientFilterOptions.find((option) => option.value === clientFilter)}
              onChange={(option) => setClientFilter(option?.value || 'all')}
              styles={appSelectStyles}
            />
          </label>
          </div>
        ) : null}

        {showFilters ? (
          <div className="projects-summary" aria-label="Resumen de proyectos filtrados">
            <article className="projects-summary-card">
              <p>Proyectos filtrados</p>
              <strong>{filteredProjects.length}</strong>
            </article>
            <article className="projects-summary-card">
              <p>Total proyectado</p>
              <strong>{formatArs(projectTotals.total)}</strong>
            </article>
            <article className="projects-summary-card">
              <p>Cobrado</p>
              <strong>{formatArs(projectTotals.collected)}</strong>
            </article>
            <article className="projects-summary-card">
              <p>Pendiente</p>
              <strong>{formatArs(projectTotals.pending)}</strong>
            </article>
          </div>
        ) : null}

        {loading ? (
          <p>Cargando proyectos...</p>
        ) : projects.length === 0 ? (
          <p>No hay proyectos cargados.</p>
        ) : filteredProjects.length === 0 ? (
          <p>No hay proyectos que coincidan con los filtros seleccionados.</p>
        ) : (
          <div className="projects-table-scroll" data-tour="projects-table">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Entrega</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const tooltipDetails = [
                    `Cliente: ${clientsById[project.clientId]?.company || 'Sin cliente'}`,
                    `Estado: ${getProjectStatusLabel(project.status)}`,
                    `Horas: ${project.finalHours ?? '-'}`,
                    `USD/h: ${project.usdPerHour ?? '-'}`,
                    `Cotizacion: ${project.usdRate ?? '-'}`,
                    `Cobro: ${project.collectionDate || '-'}`,
                  ].join('\n')

                  return (
                    <tr key={project.id} title={tooltipDetails}>
                      <td>{project.code || '-'}</td>
                      <td title={tooltipDetails}>{project.name}</td>
                      <td>{getProjectStatusLabel(project.status)}</td>
                      <td>{project.startDate || '-'}</td>
                      <td>{project.deliveryDate || '-'}</td>
                      <td>{project.total ?? '-'}</td>
                      <td>{project.paid ? 'Si' : 'No'}</td>
                      <td className="projects-actions-cell">
                        <div className="projects-actions-content">
                          <button
                            type="button"
                            onClick={() => handleEdit(project)}
                            className="projects-row-button ui-button-with-icon"
                            aria-label="Editar proyecto"
                            title="Editar proyecto"
                          >
                            <Pencil className="ui-button-icon" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectToDelete(project)}
                            className="projects-row-button projects-row-button--danger ui-button-with-icon"
                            aria-label="Eliminar proyecto"
                            title="Eliminar proyecto"
                          >
                            <Trash2 className="ui-button-icon" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingProjectId ? 'Editar proyecto' : 'Nuevo proyecto'}
        size="lg"
        isBusy={saving}
      >
        <form className="projects-form projects-form--modal" onSubmit={handleSubmit}>
          {isCreateBlocked ? (
            <p className="projects-form-alert" role="alert">
              No puedes crear proyectos porque no hay clientes cargados. Ve al modulo
              Clientes, crea al menos uno y vuelve a intentarlo.
            </p>
          ) : null}

          {!tariffLoading && !hasUsdPerHour ? (
            <p className="projects-form-alert" role="alert">
              No puedes crear proyectos porque no hay tarifa vigente de diseno. Ve al
              modulo Tarifas y carga una.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="projects-form-alert" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="projects-field projects-field--full">
            <label htmlFor="project-client">Cliente</label>
            <Select
              inputId="project-client"
              classNamePrefix="projects-select"
              isSearchable
              options={clientFormOptions}
              value={clientFormOptions.find((option) => option.value === formData.clientId) || null}
              onChange={(option) => handleSelectFieldChange('clientId', option)}
              isDisabled={clientsLoading || !hasClients}
              placeholder={
                clientsLoading
                  ? 'Cargando clientes...'
                  : clients.length === 0
                    ? 'Sin clientes disponibles'
                    : 'Selecciona un cliente'
              }
              noOptionsMessage={() => (clientsLoading ? 'Cargando...' : 'Sin clientes disponibles')}
              styles={appSelectStyles}
            />
            {!clientsLoading && clients.length === 0 ? (
              <p className="projects-hint">Primero crea clientes en el modulo Clientes.</p>
            ) : null}
          </div>

          <div className="projects-field">
            <label htmlFor="project-name">Nombre</label>
            <input
              id="project-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isCreateBlocked}
              required
            />
          </div>

          <div className="projects-field">
            <label htmlFor="project-status">Estado</label>
            <Select
              inputId="project-status"
              classNamePrefix="projects-select"
              isSearchable={false}
              options={statusFormOptions}
              value={statusFormOptions.find((option) => option.value === formData.status) || null}
              onChange={(option) => handleSelectFieldChange('status', option)}
              isDisabled={isCreateBlocked}
              styles={appSelectStyles}
            />
          </div>

          <div className="projects-field">
            <label htmlFor="project-start-date">Fecha inicio</label>
            <div className="projects-date-field">
              <button
                id="project-start-date"
                type="button"
                className={`projects-date-trigger${formData.startDate ? '' : ' projects-date-trigger--empty'}`}
                onClick={() => setOpenDatePicker((current) => (current === 'startDate' ? null : 'startDate'))}
                disabled={isCreateBlocked}
                aria-haspopup="dialog"
                aria-expanded={openDatePicker === 'startDate'}
                ref={setDateTriggerRef('startDate')}
              >
                {formatDateLabel(formData.startDate)}
                <CalendarDays className="projects-date-trigger-icon" aria-hidden="true" />
              </button>
              {renderDatePopover(
                'startDate',
                'Seleccionar fecha de inicio',
                parseDateInput(formData.startDate),
                (date) => handleDateSelection('startDate', date),
                undefined,
              )}
            </div>
          </div>

          <div className="projects-field">
            <label htmlFor="project-delivery-date">Fecha estimada de entrega</label>
            <div className="projects-date-field">
              <button
                id="project-delivery-date"
                type="button"
                className={`projects-date-trigger${formData.deliveryDate ? '' : ' projects-date-trigger--empty'}`}
                onClick={() => setOpenDatePicker((current) => (current === 'deliveryDate' ? null : 'deliveryDate'))}
                disabled={isCreateBlocked}
                aria-haspopup="dialog"
                aria-expanded={openDatePicker === 'deliveryDate'}
                ref={setDateTriggerRef('deliveryDate')}
              >
                {formatDateLabel(formData.deliveryDate)}
                <CalendarDays className="projects-date-trigger-icon" aria-hidden="true" />
              </button>
              {renderDatePopover(
                'deliveryDate',
                'Seleccionar fecha estimada de entrega',
                parseDateInput(formData.deliveryDate),
                (date) => handleDateSelection('deliveryDate', date),
                todayDateObject ? { before: todayDateObject } : undefined,
              )}
            </div>
          </div>

          <section
            className={`projects-closing projects-panel${
              isCompletedStatus ? ' projects-panel--expanded' : ' projects-panel--collapsed'
            }`}
            aria-label="Cierre del proyecto"
          >
            <h3>Cierre del proyecto</h3>
            <p className="projects-hint projects-closing-hint">
              {isCompletedStatus
                ? 'Completa horas, tarifa y cotizacion para calcular el total final.'
                : 'Este bloque se habilita cuando el estado del proyecto pasa a Finalizado.'}
            </p>

            <div
              className={`projects-panel-body${isCompletedStatus ? ' projects-panel-body--expanded' : ''}`}
              aria-hidden={!isCompletedStatus}
            >
              <div className="projects-field">
                <label htmlFor="project-final-hours">Horas finales</label>
                <input
                  id="project-final-hours"
                  name="finalHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.finalHours}
                  onChange={handleChange}
                  placeholder="Ej: 120"
                  disabled={isCreateBlocked || isTariffBlocked || !isCompletedStatus}
                  required={isCompletedStatus}
                />
              </div>

              <div className="projects-field">
                <label htmlFor="project-usd-hourly-rate">Tarifa vigente (USD/h)</label>
                <input
                  id="project-usd-hourly-rate"
                  name="usdPerHour"
                  type="number"
                  value={formData.usdPerHour}
                  readOnly
                  placeholder="Se toma desde Tarifas"
                />
                <p className="projects-rate-info projects-rate-info--hint">
                  Se toma automaticamente la tarifa vigente de diseno.
                </p>
              </div>

              <div className="projects-field">
                <label htmlFor="project-usd-rate">Cotizacion dolar</label>
                <div className="projects-rate-field">
                  <input
                    id="project-usd-rate"
                    name="usdRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.usdRate}
                    onChange={handleChange}
                    placeholder="Ej: 1450"
                    disabled={isCreateBlocked || isTariffBlocked || !isCompletedStatus || !hasFinalHours}
                    required={isCompletedStatus && hasFinalHours && hasUsdPerHour}
                  />
                  <button
                    type="button"
                    onClick={loadUsdRate}
                    className="projects-rate-refresh"
                    disabled={isCreateBlocked || isTariffBlocked || !isCompletedStatus || rateLoading || !hasFinalHours}
                  >
                    {rateLoading ? 'Cargando...' : 'Autocompletar'}
                  </button>
                </div>
                {rateInfo ? (
                  <p className="projects-rate-info">{rateInfo}</p>
                ) : (
                  <p className="projects-rate-info projects-rate-info--hint">
                    Para finalizar el proyecto debes cargar horas finales y cotizacion.
                  </p>
                )}
              </div>

              <div className="projects-field projects-field--full">
                <label htmlFor="project-total">Total ARS (horas x usd/h x cotizacion)</label>
                <input
                  id="project-total"
                  name="total"
                  value={calculatedTotal}
                  readOnly
                  placeholder="Se calcula automaticamente"
                />
              </div>
            </div>
          </section>

          <section
            className={`projects-payment projects-panel${
              isCompletedStatus ? ' projects-panel--expanded' : ' projects-panel--collapsed'
            }`}
            aria-label="Estado de cobro"
          >
            <h3>Cobro</h3>

            <p className="projects-hint">
              {isCompletedStatus
                ? 'Registra el estado de cobro cuando el cierre del proyecto este completo.'
                : 'Este bloque se habilita cuando el proyecto esta en estado Finalizado.'}
            </p>

            <div
              className={`projects-panel-body${isCompletedStatus ? ' projects-panel-body--expanded' : ''}`}
              aria-hidden={!isCompletedStatus}
            >
                {!hasClosingData ? (
                  <p className="projects-hint">
                    Completa primero el cierre del proyecto (horas y total) para habilitar
                    el estado de cobro.
                  </p>
                ) : null}

                <label className="projects-paid" htmlFor="project-paid">
                  <input
                    id="project-paid"
                    name="paid"
                    type="checkbox"
                    checked={formData.paid}
                    onChange={handleChange}
                    disabled={isCreateBlocked || !hasClosingData}
                  />
                  Pago recibido
                </label>

                <div className="projects-field">
                  <label htmlFor="project-collection-date">Fecha de cobro</label>
                  <div className="projects-date-field">
                    <button
                      id="project-collection-date"
                      type="button"
                      className={`projects-date-trigger${formData.collectionDate ? '' : ' projects-date-trigger--empty'}`}
                      onClick={() => setOpenDatePicker((current) => (current === 'collectionDate' ? null : 'collectionDate'))}
                      disabled={isCreateBlocked || !hasClosingData || !formData.paid}
                      aria-haspopup="dialog"
                      aria-expanded={openDatePicker === 'collectionDate'}
                      ref={setDateTriggerRef('collectionDate')}
                    >
                      {formatDateLabel(formData.collectionDate)}
                      <CalendarDays className="projects-date-trigger-icon" aria-hidden="true" />
                    </button>
                    {renderDatePopover(
                      'collectionDate',
                      'Seleccionar fecha de cobro',
                      parseDateInput(formData.collectionDate),
                      (date) => handleDateSelection('collectionDate', date),
                      undefined,
                    )}
                  </div>
                </div>
            </div>
          </section>

          <button
            type="submit"
            className={`projects-submit${saving ? ' projects-submit--saving' : ''}${isCreateBlocked ? ' projects-submit--blocked' : ''}`}
            disabled={saving || isCreateBlocked || isTariffBlocked}
          >
            {saving
              ? <span className="ui-inline-loader">Guardando...</span>
              : editingProjectId
                ? 'Actualizar proyecto'
                : 'Crear proyecto'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(projectToDelete)}
        onClose={closeDeleteModal}
        title="Eliminar proyecto"
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
          Vas a eliminar el proyecto{' '}
          <strong>{projectToDelete?.name || 'seleccionado'}</strong>. Esta accion no
          se puede deshacer.
        </p>
      </Modal>

      {errorMessage && !isFormOpen ? <p className="projects-error">{errorMessage}</p> : null}
    </section>
  )
}

export default ProjectsManager