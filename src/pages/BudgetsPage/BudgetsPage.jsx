import { useOutletContext } from 'react-router-dom'
import BudgetsManager from '../../components/BudgetsManager/BudgetsManager.jsx'
import './BudgetsPage.css'

function BudgetsPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="budgets-page" aria-label="Pagina de presupuestos">
      <BudgetsManager user={user} notify={notify} />
    </section>
  )
}

export default BudgetsPage
