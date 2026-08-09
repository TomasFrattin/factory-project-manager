import { useOutletContext } from 'react-router-dom'
import FactoryHoursManager from '../../components/FactoryHoursManager/FactoryHoursManager.jsx'
import './FactoryHoursPage.css'

function FactoryHoursPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="factory-hours-page" aria-label="Pagina de horas fabrica">
      <FactoryHoursManager user={user} notify={notify} />
    </section>
  )
}

export default FactoryHoursPage
