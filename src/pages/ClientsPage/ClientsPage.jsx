import { useOutletContext } from 'react-router-dom'
import ClientsManager from '../../components/ClientsManager/ClientsManager.jsx'
import './ClientsPage.css'

function ClientsPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="clients-page" aria-label="Pagina de clientes">
      <ClientsManager user={user} notify={notify} />
    </section>
  )
}

export default ClientsPage
