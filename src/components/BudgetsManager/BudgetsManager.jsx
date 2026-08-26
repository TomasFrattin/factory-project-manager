import { useEffect, useMemo, useState } from 'react'
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import { Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { PresupuestoPDFDocument } from './PresupuestoPDFDocument.jsx'
import './BudgetsManager.css'

const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const formatDateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateLabel = (value) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
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

const createDocumentForm = () => ({
  fecha: formatDateInput(new Date()),
  numero: '',
})

const createProfessionalProfileFallback = (user) => ({
  professionalName: user.name || '',
  contactEmail: user.email || '',
  phone: '',
  address: '',
  signatureUrl: '',
})

const createConditionsForm = () => ({
  formaPago: 'Entrega total al finalizar el proyecto',
  validez: '-',
  plazoEntrega: 'A definir segun alcance',
  formaEntrega: 'Informe digital PDF - A convenir con cliente',
  observaciones: 'Los precios no incluyen revisiones posteriores al alcance acordado.',
  ivaPercent: '0',
})

const getProjectTotal = (project) => {
  const directTotal = toNumber(project.total)

  if (directTotal !== null) {
    return directTotal
  }

  const finalHours = toNumber(project.finalHours)
  const usdPerHour = toNumber(project.usdPerHour)
  const usdRate = toNumber(project.usdRate)

  if (finalHours === null || usdPerHour === null || usdRate === null) {
    return null
  }

  return Number((finalHours * usdPerHour * usdRate).toFixed(2))
}

const getFactoryTotal = (record) => {
  const directTotal = toNumber(record.totalArs)

  if (directTotal !== null) {
    return directTotal
  }

  const hours = toNumber(record.factoryHours)
  const usdPerHour = toNumber(record.usdPerHour)
  const usdRate = toNumber(record.usdRate)

  if (hours === null || usdPerHour === null || usdRate === null) {
    return null
  }

  return Number((hours * usdPerHour * usdRate).toFixed(2))
}

function BudgetsManager({ user, notify }) {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [factoryRecords, setFactoryRecords] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedItemKeys, setSelectedItemKeys] = useState({})
  const [documentForm, setDocumentForm] = useState(createDocumentForm())
  const [professionalProfile, setProfessionalProfile] = useState(() => createProfessionalProfileFallback(user))
  const [conditionsForm, setConditionsForm] = useState(createConditionsForm())
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const getStatusMark = (hasValue) => (hasValue ? '✓' : '✗')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const clientsQuery = query(collection(db, 'clients'), where('userId', '==', user.uid))
        const projectsQuery = query(collection(db, 'projects'), where('userId', '==', user.uid))
        const factoryQuery = query(collection(db, 'factoryHours'), where('userId', '==', user.uid))
        const profileDocRef = doc(db, 'userProfiles', user.uid)

        const [clientsSnapshot, projectsSnapshot, factorySnapshot, profileSnapshot] = await Promise.all([
          getDocs(clientsQuery),
          getDocs(projectsQuery),
          getDocs(factoryQuery),
          getDoc(profileDocRef),
        ])

        if (!mounted) {
          return
        }

        const loadedClients = clientsSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))

        loadedClients.sort((a, b) => {
          const companyA = String(a.company || '').toLowerCase()
          const companyB = String(b.company || '').toLowerCase()
          return companyA > companyB ? 1 : companyA < companyB ? -1 : 0
        })

        const loadedProjects = projectsSnapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((project) => normalizeStatus(project.status) === 'finalizado')

        loadedProjects.sort((a, b) => {
          const codeA = String(a.code || '')
          const codeB = String(b.code || '')
          return codeA < codeB ? -1 : codeA > codeB ? 1 : 0
        })

        const loadedFactory = factorySnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))

        const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {}
        const normalizedProfile = {
          professionalName: String(profileData.professionalName || user.name || '').trim(),
          contactEmail: String(profileData.contactEmail || user.email || '').trim(),
          phone: String(profileData.phone || '').trim(),
          address: String(profileData.address || '').trim(),
          signatureUrl: String(profileData.signatureUrl || '').trim(),
        }

        loadedFactory.sort((a, b) => {
          const dateA = String(a.date || '')
          const dateB = String(b.date || '')
          return dateA < dateB ? 1 : dateA > dateB ? -1 : 0
        })

        setClients(loadedClients)
        setProjects(loadedProjects)
        setFactoryRecords(loadedFactory)
        setProfessionalProfile(normalizedProfile)
      } catch (error) {
        console.error('Error al cargar datos del presupuestador:', error)
        if (mounted) {
          setErrorMessage('No se pudieron cargar los datos para el presupuestador.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [user.uid])

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const sourceItems = useMemo(() => {
    const fromProjects = projects
      .map((project) => {
        const hours = toNumber(project.finalHours)
        const subtotal = getProjectTotal(project)

        if (hours === null || subtotal === null || subtotal <= 0) {
          return null
        }

        const unitPrice = hours > 0 ? Number((subtotal / hours).toFixed(2)) : subtotal
        const descriptionParts = []

        if (project.code) {
          descriptionParts.push(project.code)
        }

        if (project.name) {
          descriptionParts.push(project.name)
        }

        return {
          key: `project-${project.id}`,
          sourceType: 'project',
          sourceId: project.id,
          sourceDate: project.deliveryDate || project.startDate || '',
          description: descriptionParts.join(' - ') || 'Proyecto finalizado',
          hours,
          unitPrice,
          subtotal,
        }
      })
      .filter(Boolean)

    const fromFactory = factoryRecords
      .map((record) => {
        const hours = toNumber(record.factoryHours)
        const subtotal = getFactoryTotal(record)

        if (hours === null || subtotal === null || subtotal <= 0) {
          return null
        }

        const unitPrice = hours > 0 ? Number((subtotal / hours).toFixed(2)) : subtotal
        const recordDate = record.date || ''
        const description = record.comment
          ? `Hs Fabrica ${recordDate} - ${record.comment}`
          : `Hs Fabrica ${recordDate}`

        return {
          key: `factory-${record.id}`,
          sourceType: 'factory',
          sourceId: record.id,
          sourceDate: recordDate,
          description,
          hours,
          unitPrice,
          subtotal,
        }
      })
      .filter(Boolean)

    return [...fromProjects, ...fromFactory]
  }, [factoryRecords, projects])

  const selectedItems = useMemo(() => {
    return sourceItems.filter((item) => Boolean(selectedItemKeys[item.key]))
  }, [selectedItemKeys, sourceItems])

  const budgetTotals = useMemo(() => {
    const subtotal = selectedItems.reduce((accumulator, item) => accumulator + item.subtotal, 0)
    const ivaPercent = Number.parseFloat(String(conditionsForm.ivaPercent || '0').replace(',', '.'))
    const sanitizedIvaPercent = Number.isFinite(ivaPercent) ? ivaPercent : 0
    const iva = Number((subtotal * sanitizedIvaPercent / 100).toFixed(2))

    return {
      subtotal: Number(subtotal.toFixed(2)),
      iva,
      total: Number((subtotal + iva).toFixed(2)),
      ivaPercent: sanitizedIvaPercent,
    }
  }, [conditionsForm.ivaPercent, selectedItems])

  const budgetClientData = useMemo(() => {
    const fallbackName = selectedClient
      ? [selectedClient.company, selectedClient.name].filter(Boolean).join(' - ')
      : ''

    return {
      nombre: fallbackName || '-',
      telefono: selectedClient?.phone || '-',
      direccion: selectedClient?.address || '-',
      contacto: selectedClient?.contact || '-',
      logoUrl: String(selectedClient?.logoUrl || '').trim(),
    }
  }, [selectedClient])

  const budgetProfessionalData = useMemo(() => {
    return {
      nombre: professionalProfile.professionalName || user.name || '-',
      telefono: professionalProfile.phone || '-',
      email: professionalProfile.contactEmail || user.email || '-',
      direccion: professionalProfile.address || '-',
      fecha: formatDateLabel(documentForm.fecha),
      numero: documentForm.numero || '-',
      firmaUrl: String(professionalProfile.signatureUrl || '').trim(),
    }
  }, [documentForm.fecha, documentForm.numero, professionalProfile, user.email, user.name])

  const missingProfessionalFields = useMemo(() => {
    const missing = []

    if (!professionalProfile.professionalName && !user.name) {
      missing.push('nombre')
    }

    if (!professionalProfile.contactEmail && !user.email) {
      missing.push('email')
    }

    if (!professionalProfile.phone) {
      missing.push('telefono')
    }

    if (!professionalProfile.address) {
      missing.push('direccion')
    }

    if (!professionalProfile.signatureUrl) {
      missing.push('firma')
    }

    return missing
  }, [professionalProfile, user.email, user.name])

  const pdfItems = useMemo(() => {
    return selectedItems.map((item) => ({
      id: item.key,
      descripcion: item.description,
      horas: item.hours,
      precioUnitario: item.unitPrice,
      subtotal: item.subtotal,
    }))
  }, [selectedItems])

  const pdfConditions = useMemo(() => {
    return {
      ...conditionsForm,
      fechaActualizacionValores: formatDateLabel(documentForm.fecha),
    }
  }, [conditionsForm, documentForm.fecha])

  const pdfTotals = useMemo(() => {
    return {
      subtotal: budgetTotals.subtotal,
      iva: budgetTotals.iva,
      total: budgetTotals.total,
      ivaLabel: `${new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(budgetTotals.ivaPercent)}%`,
    }
  }, [budgetTotals.iva, budgetTotals.ivaPercent, budgetTotals.subtotal, budgetTotals.total])

  const canGeneratePdf = selectedItems.length > 0

  const budgetDocument = (
    <PresupuestoPDFDocument
      profesional={budgetProfessionalData}
      cliente={budgetClientData}
      items={pdfItems}
      condiciones={pdfConditions}
      totales={pdfTotals}
    />
  )

  const handleToggleItem = (itemKey) => {
    setSelectedItemKeys((current) => ({
      ...current,
      [itemKey]: !current[itemKey],
    }))
  }

  const handleSelectBulk = (sourceType) => {
    setSelectedItemKeys((current) => {
      const updated = { ...current }

      sourceItems.forEach((item) => {
        if (item.sourceType === sourceType) {
          updated[item.key] = true
        }
      })

      return updated
    })
  }

  const handleClearSelection = () => {
    setSelectedItemKeys({})
  }

  const handleReloadData = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const clientsQuery = query(collection(db, 'clients'), where('userId', '==', user.uid))
      const projectsQuery = query(collection(db, 'projects'), where('userId', '==', user.uid))
      const factoryQuery = query(collection(db, 'factoryHours'), where('userId', '==', user.uid))
      const profileDocRef = doc(db, 'userProfiles', user.uid)

      const [clientsSnapshot, projectsSnapshot, factorySnapshot, profileSnapshot] = await Promise.all([
        getDocs(clientsQuery),
        getDocs(projectsQuery),
        getDocs(factoryQuery),
        getDoc(profileDocRef),
      ])

      const loadedClients = clientsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      const loadedProjects = projectsSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((project) => normalizeStatus(project.status) === 'finalizado')
      const loadedFactory = factorySnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {}
      const normalizedProfile = {
        professionalName: String(profileData.professionalName || user.name || '').trim(),
        contactEmail: String(profileData.contactEmail || user.email || '').trim(),
        phone: String(profileData.phone || '').trim(),
        address: String(profileData.address || '').trim(),
        signatureUrl: String(profileData.signatureUrl || '').trim(),
      }

      setClients(loadedClients)
      setProjects(loadedProjects)
      setFactoryRecords(loadedFactory)
      setProfessionalProfile(normalizedProfile)
      notify?.({
        message: 'Datos del presupuestador actualizados.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al refrescar presupuestador:', error)
      setErrorMessage('No se pudieron refrescar los datos del presupuestador.')
      notify?.({
        message: 'No se pudieron refrescar los datos del presupuestador.',
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="budgets-manager" aria-label="Presupuestador">
      <header className="budgets-manager-header">
        <h2>Presupuestador</h2>
        <p>
          Selecciona proyectos finalizados y horas fabrica, completa datos fijos y genera un PDF
          con la plantilla comercial.
        </p>
      </header>

      {errorMessage ? <p className="budgets-error">{errorMessage}</p> : null}

      {loading ? <p>Cargando datos del presupuestador...</p> : null}

      {!loading ? (
        <>
          <div className="budgets-grid">
            <article className="budgets-panel" aria-label="Datos para presupuesto">
              <h3>Datos del documento</h3>
              <div className="budgets-form-grid">
                <div className="budgets-field budgets-field--full">
                  <label htmlFor="budget-client">Cliente</label>
                  <select
                    id="budget-client"
                    value={selectedClientId}
                    onChange={(event) => setSelectedClientId(event.target.value)}
                  >
                    <option value="">Seleccionar cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company || 'Sin empresa'}{client.name ? ` - ${client.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="budgets-client-snapshot budgets-field--full" aria-live="polite">
                  {selectedClient ? (
                    <>
                      <p><strong>Contacto:</strong> {selectedClient.contact || '-'}</p>
                      <p><strong>Telefono:</strong> {selectedClient.phone || '-'}</p>
                      <p><strong>Direccion:</strong> {selectedClient.address || '-'}</p>
                      <p><strong>Logo cliente:</strong> {getStatusMark(Boolean(budgetClientData.logoUrl))}</p>
                    </>
                  ) : (
                    <p>Selecciona un cliente para usar automaticamente sus datos en el PDF.</p>
                  )}
                </div>

                <div className="budgets-field">
                  <label htmlFor="budget-number">N de presupuesto</label>
                  <input
                    id="budget-number"
                    value={documentForm.numero}
                    onChange={(event) => setDocumentForm((current) => ({
                      ...current,
                      numero: event.target.value,
                    }))}
                    placeholder="Ej: PRES-2026-001"
                  />
                </div>

                <div className="budgets-field">
                  <label htmlFor="budget-date">Fecha</label>
                  <input
                    id="budget-date"
                    type="date"
                    value={documentForm.fecha}
                    onChange={(event) => setDocumentForm((current) => ({
                      ...current,
                      fecha: event.target.value,
                    }))}
                  />
                </div>

                <div className="budgets-professional-snapshot budgets-field--full" aria-live="polite">
                  <p><strong>Profesional:</strong> {budgetProfessionalData.nombre}</p>
                  <p><strong>Telefono:</strong> {budgetProfessionalData.telefono}</p>
                  <p><strong>Email:</strong> {budgetProfessionalData.email}</p>
                  <p><strong>Direccion:</strong> {budgetProfessionalData.direccion}</p>
                  <p><strong>Firma profesional:</strong> {getStatusMark(Boolean(budgetProfessionalData.firmaUrl))}</p>
                  <p className="budgets-hint">Usa links directos y publicos de imagen (png/jpg/webp) para que se vean en el PDF.</p>
                </div>

                {missingProfessionalFields.length > 0 ? (
                  <p className="budgets-profile-warning budgets-field--full">
                    Faltan datos del perfil ({missingProfessionalFields.join(', ')}). Completalos en{' '}
                    <Link to="/profile" className="budgets-profile-link">Mi perfil</Link>.
                  </p>
                ) : null}

                <details className="budgets-conditions budgets-field--full">
                  <summary>Condiciones comerciales</summary>
                  <div className="budgets-conditions-grid">
                    <div className="budgets-field">
                      <label htmlFor="budget-iva">IVA (%)</label>
                      <input
                        id="budget-iva"
                        value={conditionsForm.ivaPercent}
                        onChange={(event) => setConditionsForm((current) => ({
                          ...current,
                          ivaPercent: event.target.value,
                        }))}
                      />
                    </div>

                    <div className="budgets-field">
                      <label htmlFor="budget-payment-method">Forma de pago</label>
                      <input
                        id="budget-payment-method"
                        value={conditionsForm.formaPago}
                        onChange={(event) => setConditionsForm((current) => ({
                          ...current,
                          formaPago: event.target.value,
                        }))}
                      />
                    </div>

                    <div className="budgets-field">
                      <label htmlFor="budget-validity">Validez</label>
                      <input
                        id="budget-validity"
                        value={conditionsForm.validez}
                        onChange={(event) => setConditionsForm((current) => ({
                          ...current,
                          validez: event.target.value,
                        }))}
                      />
                    </div>

                    <div className="budgets-field">
                      <label htmlFor="budget-delivery-time">Plazo de entrega</label>
                      <input
                        id="budget-delivery-time"
                        value={conditionsForm.plazoEntrega}
                        onChange={(event) => setConditionsForm((current) => ({
                          ...current,
                          plazoEntrega: event.target.value,
                        }))}
                      />
                    </div>

                    <div className="budgets-field budgets-field--full">
                      <label htmlFor="budget-delivery-method">Forma de entrega</label>
                      <input
                        id="budget-delivery-method"
                        value={conditionsForm.formaEntrega}
                        onChange={(event) => setConditionsForm((current) => ({
                          ...current,
                          formaEntrega: event.target.value,
                        }))}
                      />
                    </div>
                  </div>
                </details>

                <div className="budgets-field budgets-field--full">
                  <label htmlFor="budget-notes">Observaciones</label>
                  <textarea
                    id="budget-notes"
                    value={conditionsForm.observaciones}
                    onChange={(event) => setConditionsForm((current) => ({
                      ...current,
                      observaciones: event.target.value,
                    }))}
                  />
                </div>
              </div>
            </article>

            <article className="budgets-panel" aria-label="Seleccion de items">
              <div className="budgets-items-head">
                <h4>Items del presupuesto</h4>
                <div className="budgets-inline-actions">
                  <button type="button" onClick={() => handleSelectBulk('project')}>
                    Marcar proyectos
                  </button>
                  <button type="button" onClick={() => handleSelectBulk('factory')}>
                    Marcar horas fabrica
                  </button>
                  <button type="button" onClick={handleClearSelection}>
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="budgets-items-list">
                {sourceItems.length === 0 ? (
                  <p className="budgets-empty">No hay proyectos finalizados ni horas fabrica para presupuestar.</p>
                ) : (
                  sourceItems.map((item) => (
                    <label className="budgets-item-row" key={item.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItemKeys[item.key])}
                        onChange={() => handleToggleItem(item.key)}
                      />
                      <span className="budgets-item-main">
                        <strong>{item.description}</strong>
                        <small>
                          {item.sourceType === 'project' ? 'Proyecto finalizado' : 'Horas fabrica'}
                          {item.sourceDate ? ` - ${formatDateLabel(item.sourceDate)}` : ''}
                          {` - ${item.hours} hs`}
                        </small>
                      </span>
                      <span className="budgets-item-amount">{formatArs(item.subtotal)}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="budgets-summary" aria-label="Resumen economico">
                <p>
                  <span>Items seleccionados</span>
                  <strong>{selectedItems.length}</strong>
                </p>
                <p>
                  <span>Subtotal</span>
                  <strong>{formatArs(budgetTotals.subtotal)}</strong>
                </p>
                <p>
                  <span>IVA ({budgetTotals.ivaPercent}%)</span>
                  <strong>{formatArs(budgetTotals.iva)}</strong>
                </p>
                <p>
                  <span>Total</span>
                  <strong>{formatArs(budgetTotals.total)}</strong>
                </p>
              </div>
            </article>
          </div>

          <article className="budgets-preview-panel" aria-label="Preview de PDF">
            <div className="budgets-preview-head">
              <h3>Vista previa PDF</h3>
              <div className="budgets-preview-actions">
                <button type="button" onClick={handleReloadData}>
                  Actualizar datos
                </button>
                <PDFDownloadLink
                  document={budgetDocument}
                  fileName={`presupuesto-${documentForm.numero || 'sin-numero'}.pdf`}
                  className={`budgets-download-link${canGeneratePdf ? '' : ' budgets-download-link--disabled'}`}
                >
                  {({ loading: downloading }) => {
                    if (!canGeneratePdf) {
                      return 'Selecciona items para descargar'
                    }

                    return downloading ? 'Generando PDF...' : 'Descargar PDF'
                  }}
                </PDFDownloadLink>
              </div>
            </div>

            <div className="budgets-viewer-wrap">
              <PDFViewer className="budgets-viewer" showToolbar>
                {budgetDocument}
              </PDFViewer>
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}

export default BudgetsManager
