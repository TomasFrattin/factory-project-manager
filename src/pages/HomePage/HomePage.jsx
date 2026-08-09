import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getBnaUsdRate } from '../../services/exchangeRate.js'
import './HomePage.css'

const DASHBOARD_RATE_REFRESH_MS = 5 * 60 * 1000

const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

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

function HomePage({ user }) {
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [bnaRate, setBnaRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(true)
  const [rateError, setRateError] = useState('')

  useEffect(() => {
    setProjectsLoading(true)
    setProjectsError('')

    const projectsRef = collection(db, 'projects')
    const projectsQuery = query(projectsRef, where('userId', '==', user.uid))

    const unsubscribe = onSnapshot(
      projectsQuery,
      (snapshot) => {
        const loadedProjects = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))

        loadedProjects.sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
        setProjects(loadedProjects)
        setProjectsLoading(false)
      },
      (error) => {
        console.error('Error al cargar dashboard de proyectos:', error)
        setProjectsError('No se pudieron cargar los proyectos del dashboard.')
        setProjectsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user.uid])

  useEffect(() => {
    let active = true

    const loadBnaRate = async () => {
      setRateLoading(true)

      try {
        const rate = await getBnaUsdRate()

        if (!active) {
          return
        }

        setBnaRate(rate)
        setRateError('')
      } catch (error) {
        if (!active) {
          return
        }

        console.error('Error al cargar cotizacion de dolar BNA:', error)
        setRateError('No se pudo obtener la cotizacion del dolar BNA.')
      } finally {
        if (active) {
          setRateLoading(false)
        }
      }
    }

    loadBnaRate()
    const intervalId = window.setInterval(loadBnaRate, DASHBOARD_RATE_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  const urgentProjects = useMemo(
    () => projects.filter((project) => normalizeStatus(project.status) === 'urgente'),
    [projects],
  )

  const unpaidProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          normalizeStatus(project.status) === 'finalizado' &&
          !Boolean(project.paid),
      ),
    [projects],
  )

  return (
    <section className="home-dashboard" aria-label="Dashboard de inicio">
      <article
        className="home-panel home-panel--usd"
        aria-label="Cotizacion dolar BNA"
        data-tour="home-usd-panel"
      >
        <h2>Dolar Banco Nacion</h2>
        {rateLoading ? <p>Cargando cotizacion...</p> : null}
        {!rateLoading && rateError ? <p>{rateError}</p> : null}
        {!rateLoading && !rateError && bnaRate ? (
          <>
            <p className="home-rate-value">Compra: {formatArs(bnaRate.buy)}</p>
            <p className="home-rate-value">Venta: {formatArs(bnaRate.sell)}</p>
            <p className="home-rate-meta">
              Ultima actualizacion: {bnaRate.updatedAt || 'Sin dato'}
            </p>
          </>
        ) : null}
      </article>

      <article className="home-panel" aria-label="Proyectos urgentes" data-tour="home-urgent-panel">
        <h2>Proyectos urgentes</h2>
        {projectsLoading ? <p>Cargando proyectos...</p> : null}
        {!projectsLoading && projectsError ? <p>{projectsError}</p> : null}
        {!projectsLoading && !projectsError && urgentProjects.length === 0 ? (
          <p>No hay proyectos en estado urgente.</p>
        ) : null}
        {!projectsLoading && !projectsError && urgentProjects.length > 0 ? (
          <ul className="home-projects-list">
            {urgentProjects.map((project) => (
              <li key={project.id}>
                <span>{project.code || 'Sin codigo'} - {project.name || 'Sin nombre'}</span>
                <small>Entrega: {project.deliveryDate || 'Sin fecha'}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="home-panel" aria-label="Proyectos pendientes de cobro" data-tour="home-unpaid-panel">
        <h2>Proyectos pendientes de cobro</h2>
        {projectsLoading ? <p>Cargando proyectos...</p> : null}
        {!projectsLoading && projectsError ? <p>{projectsError}</p> : null}
        {!projectsLoading && !projectsError && unpaidProjects.length === 0 ? (
          <p>No hay proyectos pendientes de cobro.</p>
        ) : null}
        {!projectsLoading && !projectsError && unpaidProjects.length > 0 ? (
          <ul className="home-projects-list">
            {unpaidProjects.map((project) => {
              const amount = getProjectAmount(project)

              return (
                <li key={project.id}>
                  <span>{project.code || 'Sin codigo'} - {project.name || 'Sin nombre'}</span>
                  <small>Costo: {amount !== null ? formatArs(amount) : 'Sin calcular'}</small>
                </li>
              )
            })}
          </ul>
        ) : null}
      </article>
    </section>
  )
}

export default HomePage