import { useOutletContext } from 'react-router-dom'
import ProjectsManager from '../../components/ProjectsManager/ProjectsManager.jsx'
import './ProjectsPage.css'

function ProjectsPage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="projects-page" aria-label="Pagina de proyectos">
      <ProjectsManager user={user} notify={notify} />
    </section>
  )
}

export default ProjectsPage
