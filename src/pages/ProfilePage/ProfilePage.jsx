import { useOutletContext } from 'react-router-dom'
import ProfileManager from '../../components/ProfileManager/ProfileManager.jsx'
import './ProfilePage.css'

function ProfilePage({ user }) {
  const { notify } = useOutletContext()

  return (
    <section className="profile-page" aria-label="Pagina de perfil">
      <ProfileManager user={user} notify={notify} />
    </section>
  )
}

export default ProfilePage
