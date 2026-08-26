import { NavLink } from 'react-router-dom'
import {
  Clock3,
  FolderKanban,
  FileText,
  HandCoins,
  House,
  LogOut,
  UserRound,
  SunMoon,
  TrendingUp,
  Users,
} from 'lucide-react'
import './SideNav.css'

function SideNav({ user, onLogout, theme, onToggleTheme }) {
  return (
    <aside className="side-nav" aria-label="Navegacion principal" data-tour="side-nav">
      <div className="side-nav-header">
        <p className="side-nav-kicker">Panel operativo</p>
        <h1>{user.name}</h1>
        <p className="side-nav-email">{user.email}</p>
      </div>

      <nav className="side-nav-links" aria-label="Modulos">
        <div className="side-nav-group side-nav-group--main">
          <NavLink
            to="/home"
            end
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
            data-tour="nav-home"
          >
            <House className="ui-button-icon" aria-hidden="true" />
            Home
          </NavLink>
        </div>

        <div className="side-nav-group side-nav-group--core">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
            data-tour="nav-projects"
          >
            <FolderKanban className="ui-button-icon" aria-hidden="true" />
            Proyectos
          </NavLink>
          <NavLink
            to="/factory-hours"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
            data-tour="nav-factory-hours"
          >
            <Clock3 className="ui-button-icon" aria-hidden="true" />
            Horas fabrica
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
            data-tour="nav-clients"
          >
            <Users className="ui-button-icon" aria-hidden="true" />
            Clientes
          </NavLink>
        </div>

        <div className="side-nav-group side-nav-group--utility">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
          >
            <UserRound className="ui-button-icon" aria-hidden="true" />
            Mi perfil
          </NavLink>
          <NavLink
            to="/tariffs"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
          >
            <HandCoins className="ui-button-icon" aria-hidden="true" />
            Tarifas
          </NavLink>
          <NavLink
            to="/notes"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
          >
            <FileText className="ui-button-icon" aria-hidden="true" />
            Notas
          </NavLink>
        </div>

        <div className="side-nav-group side-nav-group--reporting">
          <NavLink
            to="/gains"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
          >
            <TrendingUp className="ui-button-icon" aria-hidden="true" />
            Ganancias
          </NavLink>
          <NavLink
            to="/budgets"
            className={({ isActive }) =>
              isActive ? 'side-nav-link side-nav-link--active' : 'side-nav-link'
            }
          >
            <FileText className="ui-button-icon" aria-hidden="true" />
            Presupuestos
          </NavLink>
        </div>
      </nav>

      <div className="side-nav-footer">
        <button type="button" onClick={onToggleTheme} className="side-nav-theme ui-button-with-icon">
          <SunMoon className="ui-button-icon" aria-hidden="true" />
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button type="button" onClick={onLogout} className="side-nav-logout ui-button-with-icon">
          <LogOut className="ui-button-icon" aria-hidden="true" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}

export default SideNav
