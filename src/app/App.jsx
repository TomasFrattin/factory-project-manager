import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import LoginPage from '../pages/LoginPage/LoginPage.jsx'
import HomePage from '../pages/HomePage/HomePage.jsx'
import ProjectsPage from '../pages/ProjectsPage/ProjectsPage.jsx'
import ClientsPage from '../pages/ClientsPage/ClientsPage.jsx'
import FactoryHoursPage from '../pages/FactoryHoursPage/FactoryHoursPage.jsx'
import TariffsPage from '../pages/TariffsPage/TariffsPage.jsx'
import GainsPage from '../pages/GainsPage/GainsPage.jsx'
import NotesPage from '../pages/NotesPage/NotesPage.jsx'
import BudgetsPage from '../pages/BudgetsPage/BudgetsPage.jsx'
import ProfilePage from '../pages/ProfilePage/ProfilePage.jsx'
import WorkspaceLayout from './WorkspaceLayout.jsx'
import { auth, googleProvider } from '../firebase.js'
import './App.css'

function App() {
  const [sessionUser, setSessionUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSessionUser({
          uid: user.uid,
          name: user.displayName || user.email || 'Usuario',
          email: user.email || '',
        })
      } else {
        setSessionUser(null)
      }

      setAuthReady(true)
    })

    return () => unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
    setAuthError('')
    setIsSigningIn(true)

    try {
      await signInWithPopup(auth, googleProvider)
      navigate('/home', { replace: true })
    } catch (error) {
      setAuthError('No se pudo iniciar sesion con Google. Intenta nuevamente.')
      console.error('Error al iniciar sesion con Google:', error)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error al cerrar sesion:', error)
    }
  }

  if (!authReady) {
    return (
      <div className="app-shell app-shell--loading">
        <p>Verificando sesion...</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route
          path="/"
          element={<Navigate to={sessionUser ? '/home' : '/login'} replace />}
        />
        <Route
          path="/login"
          element={
            sessionUser ? (
              <Navigate to="/home" replace />
            ) : (
              <LoginPage
                onGoogleLogin={handleGoogleLogin}
                authError={authError}
                isSigningIn={isSigningIn}
              />
            )
          }
        />
        <Route
          element={
            sessionUser ? (
              <WorkspaceLayout user={sessionUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/home" element={<HomePage user={sessionUser} />} />
          <Route path="/projects" element={<ProjectsPage user={sessionUser} />} />
          <Route path="/tariffs" element={<TariffsPage user={sessionUser} />} />
          <Route path="/clients" element={<ClientsPage user={sessionUser} />} />
          <Route path="/factory-hours" element={<FactoryHoursPage user={sessionUser} />} />
          <Route path="/gains" element={<GainsPage user={sessionUser} />} />
          <Route path="/notes" element={<NotesPage user={sessionUser} />} />
          <Route path="/budgets" element={<BudgetsPage user={sessionUser} />} />
          <Route path="/profile" element={<ProfilePage user={sessionUser} />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={sessionUser ? '/home' : '/login'} replace />}
        />
      </Routes>
    </div>
  )
}

export default App