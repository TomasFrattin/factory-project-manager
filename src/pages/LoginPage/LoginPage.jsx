import './LoginPage.css'

function LoginPage({ onGoogleLogin, authError, isSigningIn }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onGoogleLogin()
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="login-tag">Factory Project Manager</p>
        <h1 id="login-title">Iniciar sesion</h1>
        <p className="login-subtitle">
          Accede con tu cuenta de Google para gestionar tus operaciones.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {authError ? (
            <p className="login-error" role="alert">
              {authError}
            </p>
          ) : null}

          <button
            type="submit"
            className="login-button"
            disabled={isSigningIn}
          >
            {isSigningIn ? 'Conectando...' : 'Iniciar sesion con Google'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage