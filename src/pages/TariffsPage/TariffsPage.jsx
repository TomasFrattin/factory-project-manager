import { useOutletContext } from 'react-router-dom'
import TariffsManager from '../../components/TariffsManager/TariffsManager.jsx'
import './TariffsPage.css'

function TariffsPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="tariffs-page" aria-label="Pagina de tarifas">
      <TariffsManager user={user} notify={notify} />
    </section>
  )
}

export default TariffsPage
