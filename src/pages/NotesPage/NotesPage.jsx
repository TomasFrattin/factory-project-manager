import { useOutletContext } from 'react-router-dom'
import NotesManager from '../../components/NotesManager/NotesManager.jsx'
import './NotesPage.css'

function NotesPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="notes-page" aria-label="Pagina de notas">
      <NotesManager user={user} notify={notify} />
    </section>
  )
}

export default NotesPage
