import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Select from 'react-select'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { appSelectStyles } from '../Select/selectStyles.js'
import './GainsManager.css'

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

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const getProjectAmount = (project) => {
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

const getFactoryAmount = (record) => {
  const directTotal = toNumber(record.totalArs)

  if (directTotal !== null) {
    return directTotal
  }

  const factoryHours = toNumber(record.factoryHours)
  const usdPerHour = toNumber(record.usdPerHour)
  const usdRate = toNumber(record.usdRate)

  if (factoryHours === null || usdPerHour === null || usdRate === null) {
    return null
  }

  return Number((factoryHours * usdPerHour * usdRate).toFixed(2))
}

const sortByCollectionDateDesc = (a, b) => {
  const dateA = a.collectionDate || ''
  const dateB = b.collectionDate || ''

  if (dateA && !dateB) {
    return -1
  }

  if (!dateA && dateB) {
    return 1
  }

  if (dateA === dateB) {
    return 0
  }

  return dateA < dateB ? 1 : -1
}

function GainsManager({ user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [collectionMonthFilter, setCollectionMonthFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const loadEntries = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const projectsQuery = query(collection(db, 'projects'), where('userId', '==', user.uid))
      const factoryHoursQuery = query(collection(db, 'factoryHours'), where('userId', '==', user.uid))

      const [projectsSnapshot, factoryHoursSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(factoryHoursQuery),
      ])

      const projectEntries = projectsSnapshot.docs
        .map((item) => {
          const data = item.data()
          const amount = getProjectAmount(data)

          if (amount === null) {
            return null
          }

          return {
            id: item.id,
            type: 'project',
            sourceLabel: data.code ? `${data.code} · ${data.name || 'Proyecto'}` : data.name || 'Proyecto',
            amount,
            paid: Boolean(data.paid),
            collectionDate: data.collectionDate || '',
          }
        })
        .filter(Boolean)

      const factoryEntries = factoryHoursSnapshot.docs
        .map((item) => {
          const data = item.data()
          const amount = getFactoryAmount(data)

          if (amount === null) {
            return null
          }

          return {
            id: item.id,
            type: 'factory',
            sourceLabel: data.date ? `Horas fabrica · ${data.date}` : 'Horas fabrica',
            amount,
            paid: Boolean(data.paid),
            collectionDate: data.collectionDate || '',
          }
        })
        .filter(Boolean)

      const mergedEntries = [...projectEntries, ...factoryEntries].sort(sortByCollectionDateDesc)
      setEntries(mergedEntries)
    } catch (error) {
      console.error('Error al cargar ganancias:', error)
      setErrorMessage('No se pudieron cargar las ganancias consolidadas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [user.uid])

  const availableCollectionMonths = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(entries.map((entry) => getMonthKey(entry.collectionDate)).filter(Boolean)),
    )

    uniqueMonths.sort((a, b) => (a < b ? 1 : -1))
    return uniqueMonths
  }, [entries])

  const monthFilterOptions = useMemo(() => {
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

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (collectionMonthFilter !== 'all') {
        const monthKey = getMonthKey(entry.collectionDate)

        if (monthKey !== collectionMonthFilter) {
          return false
        }
      }

      if (paymentFilter === 'paid' && !entry.paid) {
        return false
      }

      if (paymentFilter === 'pending' && entry.paid) {
        return false
      }

      return true
    })
  }, [collectionMonthFilter, entries, paymentFilter])

  const groupedByCollectionMonth = useMemo(() => {
    const groups = filteredEntries.reduce((accumulator, entry) => {
      const monthKey = getMonthKey(entry.collectionDate)
      const groupKey = monthKey || 'without-collection-date'

      if (!accumulator[groupKey]) {
        accumulator[groupKey] = {
          key: groupKey,
          label: monthKey ? formatMonthLabel(monthKey) : 'Sin fecha de cobro',
          total: 0,
          collected: 0,
          pending: 0,
          count: 0,
        }
      }

      accumulator[groupKey].total += entry.amount
      accumulator[groupKey].count += 1

      if (entry.paid) {
        accumulator[groupKey].collected += entry.amount
      } else {
        accumulator[groupKey].pending += entry.amount
      }

      return accumulator
    }, {})

    const list = Object.values(groups)

    list.sort((a, b) => {
      if (a.key === 'without-collection-date') {
        return 1
      }

      if (b.key === 'without-collection-date') {
        return -1
      }

      return a.key < b.key ? 1 : -1
    })

    return list
  }, [filteredEntries])

  const groupedByYear = useMemo(() => {
    const groups = groupedByCollectionMonth
      .filter((group) => group.key !== 'without-collection-date')
      .reduce((accumulator, group) => {
        const yearKey = group.key.slice(0, 4)

        if (!accumulator[yearKey]) {
          accumulator[yearKey] = {
            year: yearKey,
            months: [],
          }
        }

        accumulator[yearKey].months.push(group)
        return accumulator
      }, {})

    const years = Object.values(groups)

    years.sort((a, b) => (a.year < b.year ? 1 : -1))
    years.forEach((group) => {
      group.months.sort((a, b) => (a.key < b.key ? 1 : -1))
    })

    return years
  }, [groupedByCollectionMonth])

  const withoutCollectionDateGroup = useMemo(() => {
    return groupedByCollectionMonth.find((group) => group.key === 'without-collection-date') || null
  }, [groupedByCollectionMonth])

  return (
    <section className="gains-manager" aria-label="Resumen de ganancias">
      <div className="gains-manager-header">
        <h2>Ganancias</h2>
      </div>

      <div className="gains-list-wrap">
        <div className="gains-list-head">
          <h3>Resumen consolidado</h3>
          <button
            type="button"
            className="gains-filters-toggle ui-button-with-icon"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            aria-controls="gains-filters-panel"
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
          <div id="gains-filters-panel" className="gains-filters" aria-label="Filtros de ganancias">
            <label className="gains-filter-field" htmlFor="gains-filter-month">
              Mes de cobro
              <Select
                inputId="gains-filter-month"
                classNamePrefix="gains-select"
                isSearchable={false}
                options={monthFilterOptions}
                value={monthFilterOptions.find((option) => option.value === collectionMonthFilter)}
                onChange={(option) => setCollectionMonthFilter(option?.value || 'all')}
                styles={appSelectStyles}
              />
            </label>

            <label className="gains-filter-field" htmlFor="gains-filter-payment">
              Pago
              <Select
                inputId="gains-filter-payment"
                classNamePrefix="gains-select"
                isSearchable={false}
                options={paymentFilterOptions}
                value={paymentFilterOptions.find((option) => option.value === paymentFilter)}
                onChange={(option) => setPaymentFilter(option?.value || 'all')}
                styles={appSelectStyles}
              />
            </label>
          </div>
        ) : null}

        {loading ? (
          <p>Cargando ganancias...</p>
        ) : errorMessage ? (
          <p className="gains-error">{errorMessage}</p>
        ) : (
          <>
            {groupedByCollectionMonth.length === 0 ? (
              <p>No hay ganancias disponibles para mostrar.</p>
            ) : (
              <section className="gains-year-sections" aria-label="Ganancias agrupadas por mes de cobro">
                {groupedByYear.map((yearGroup) => (
                  <article key={yearGroup.year} className="gains-year-section">
                    <h4 className="gains-year-title">{yearGroup.year}</h4>
                    <div className="gains-month-track" role="list" aria-label={`Ganancias de ${yearGroup.year}`}>
                      {yearGroup.months.map((group) => (
                        <article key={group.key} className="gains-month-card" role="listitem">
                          <p className="gains-month-label">{group.label}</p>
                          <strong className="gains-month-total">{formatArs(group.total)}</strong>
                          <p className="gains-month-sub">{group.count} ingresos</p>
                          <p className="gains-month-sub">Cobrado: {formatArs(group.collected)}</p>
                          <p className="gains-month-sub">Pendiente: {formatArs(group.pending)}</p>
                        </article>
                      ))}
                    </div>
                  </article>
                ))}

                {withoutCollectionDateGroup ? (
                  <article className="gains-year-section gains-year-section--floating">
                    <h4 className="gains-year-title">Sin fecha de cobro</h4>
                    <div className="gains-month-track" role="list" aria-label="Ganancias sin fecha de cobro">
                      <article className="gains-month-card gains-month-card--without-date" role="listitem">
                        <p className="gains-month-label">Sin fecha de cobro</p>
                        <strong className="gains-month-total">{formatArs(withoutCollectionDateGroup.total)}</strong>
                        <p className="gains-month-sub">{withoutCollectionDateGroup.count} ingresos</p>
                        <p className="gains-month-sub">Cobrado: {formatArs(withoutCollectionDateGroup.collected)}</p>
                        <p className="gains-month-sub">Pendiente: {formatArs(withoutCollectionDateGroup.pending)}</p>
                      </article>
                    </div>
                  </article>
                ) : null}
              </section>
            )}

            <div className="gains-table-scroll">
              <table className="gains-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Referencia</th>
                    <th>Monto</th>
                    <th>Pago</th>
                    <th>Cobro</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay ingresos que coincidan con los filtros seleccionados.</td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => (
                      <tr key={`${entry.type}-${entry.id}`}>
                        <td>{entry.type === 'project' ? 'Proyecto' : 'Horas fabrica'}</td>
                        <td>{entry.sourceLabel}</td>
                        <td>{formatArs(entry.amount)}</td>
                        <td>{entry.paid ? 'Si' : 'No'}</td>
                        <td>{entry.collectionDate || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default GainsManager
