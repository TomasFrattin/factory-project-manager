import { useCallback, useEffect, useMemo, useState } from 'react'
import { Joyride, STATUS } from 'react-joyride'
import { Outlet, useLocation } from 'react-router-dom'
import SideNav from '../components/SideNav/SideNav.jsx'
import Snackbar from '../components/Snackbar/Snackbar.jsx'
import { getTourSteps } from './appTour.js'
import './WorkspaceLayout.css'

const TOUR_ENABLED = import.meta.env.VITE_ENABLE_APP_TOUR === 'true'
const THEME_STORAGE_KEY = 'fpm-theme'

const getInitialTheme = () => {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function WorkspaceLayout({ user, onLogout }) {
  const location = useLocation()
  const [theme, setTheme] = useState(getInitialTheme)
  const [snackbarState, setSnackbarState] = useState({
    open: false,
    message: '',
    tone: 'success',
  })
  const [tourRun, setTourRun] = useState(false)
  const [tourInstance, setTourInstance] = useState(0)
  const tourSteps = useMemo(() => getTourSteps(location.pathname), [location.pathname])

  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.setAttribute('data-theme', theme)
    body.classList.toggle('theme-dark', theme === 'dark')

    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!TOUR_ENABLED) {
      return
    }

    const hasSeenTour = window.localStorage.getItem('fpm-tour-seen')

    if (hasSeenTour) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTourRun(true)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [])

  const hideSnackbar = useCallback(() => {
    setSnackbarState((current) => ({ ...current, open: false }))
  }, [])

  const notify = useCallback(({ message, tone = 'success' }) => {
    setSnackbarState({
      open: true,
      message,
      tone,
    })
  }, [])

  const startTour = useCallback(() => {
    if (!TOUR_ENABLED) {
      return
    }

    setTourRun(false)

    window.requestAnimationFrame(() => {
      setTourInstance((current) => current + 1)
      setTourRun(true)
    })
  }, [])

  const handleThemeToggle = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }, [])

  const handleTourCallback = useCallback((data) => {
    const { status } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setTourRun(false)
      window.localStorage.setItem('fpm-tour-seen', '1')
    }
  }, [])

  return (
    <main className="workspace-layout-page">
      {TOUR_ENABLED ? (
        <Joyride
          key={tourInstance}
          run={tourRun}
          steps={tourSteps}
          callback={handleTourCallback}
          continuous
          closeButtonAction="skip"
          showSkipButton
          showProgress
          disableCloseOnEsc={false}
          disableOverlayClose
          scrollToFirstStep
          styles={{
            options: {
              arrowColor: 'var(--color-surface)',
              backgroundColor: 'var(--color-surface)',
              overlayColor: 'var(--overlay-scrim)',
              primaryColor: 'var(--color-secondary)',
              spotlightRadius: 14,
              textColor: 'var(--color-text)',
              width: 420,
              zIndex: 1200,
            },
            tooltip: {
              borderRadius: '16px',
              boxShadow: 'var(--shadow-panel)',
              overflow: 'hidden',
            },
            tooltipContainer: {
              padding: '18px 18px 12px',
            },
            tooltipTitle: {
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '4px',
            },
            tooltipContent: {
              fontSize: '0.92rem',
              lineHeight: 1.45,
              padding: '0',
            },
            tooltipFooter: {
              borderTop: '1px solid var(--color-border)',
              marginTop: '14px',
              paddingTop: '12px',
            },
            buttonPrimary: {
              backgroundColor: 'var(--color-secondary)',
              borderRadius: '10px',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-surface)',
              fontSize: '0.86rem',
              fontWeight: 700,
              padding: '8px 14px',
            },
            buttonBack: {
              color: 'var(--color-text-soft)',
              fontSize: '0.86rem',
              fontWeight: 600,
              marginRight: '8px',
              padding: '8px 10px',
            },
            buttonSkip: {
              color: 'var(--color-text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
            },
            buttonClose: {
              color: 'var(--color-text-muted)',
              fontSize: '1rem',
              fontWeight: 700,
              right: '10px',
              top: '10px',
            },
          }}
          locale={{
            back: 'Atras',
            close: 'Cerrar',
            last: 'Finalizar',
            next: 'Siguiente',
            skip: 'Saltar',
          }}
        />
      ) : null}

      <div className="workspace-layout-grid">
        <SideNav
          user={user}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={handleThemeToggle}
        />

        <section className="workspace-layout-content" aria-live="polite">
          <Outlet context={{ notify }} />
        </section>
      </div>

      {TOUR_ENABLED ? (
        <button
          type="button"
          className="workspace-tour-launcher"
          data-tour="tour-launcher"
          onClick={startTour}
        >
          Ayuda y tour
        </button>
      ) : null}

      <Snackbar
        open={snackbarState.open}
        message={snackbarState.message}
        tone={snackbarState.tone}
        onClose={hideSnackbar}
      />
    </main>
  )
}

export default WorkspaceLayout
