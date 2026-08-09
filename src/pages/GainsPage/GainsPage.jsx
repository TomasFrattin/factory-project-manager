import GainsManager from '../../components/GainsManager/GainsManager.jsx'
import './GainsPage.css'

function GainsPage({ user }) {
  return (
    <section className="gains-page" aria-label="Pagina de ganancias">
      <GainsManager user={user} />
    </section>
  )
}

export default GainsPage
