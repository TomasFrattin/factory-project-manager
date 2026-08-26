import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase.js'
import {
  getCloudinaryConfigError,
  hasCloudinaryConfig,
  uploadImageToCloudinary,
  validateImageFile,
} from '../../services/cloudinaryUpload.js'
import './ProfileManager.css'

const createInitialForm = (user) => ({
  professionalName: user.name || '',
  contactEmail: user.email || '',
  phone: '',
  address: '',
  signatureUrl: '',
})

function ProfileManager({ user, notify }) {
  const [formData, setFormData] = useState(() => createInitialForm(user))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedSignatureFile, setSelectedSignatureFile] = useState(null)
  const [isSignatureDragActive, setIsSignatureDragActive] = useState(false)
  const [signatureUploadError, setSignatureUploadError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const profileRef = doc(db, 'userProfiles', user.uid)
        const snapshot = await getDoc(profileRef)

        if (!mounted) {
          return
        }

        if (snapshot.exists()) {
          const data = snapshot.data()
          setFormData({
            professionalName: String(data.professionalName || user.name || '').trim(),
            contactEmail: String(data.contactEmail || user.email || '').trim(),
            phone: String(data.phone || '').trim(),
            address: String(data.address || '').trim(),
            signatureUrl: String(data.signatureUrl || '').trim(),
          })
          return
        }

        setFormData(createInitialForm(user))
      } catch (error) {
        console.error('Error al cargar perfil de usuario:', error)
        if (mounted) {
          setErrorMessage('No se pudieron cargar tus datos de perfil.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [user.email, user.name, user.uid])

  const missingFields = useMemo(() => {
    const fields = []

    if (!formData.professionalName.trim()) {
      fields.push('nombre profesional')
    }

    if (!formData.contactEmail.trim()) {
      fields.push('email')
    }

    if (!formData.phone.trim()) {
      fields.push('telefono')
    }

    if (!formData.address.trim()) {
      fields.push('direccion')
    }

    if (!formData.signatureUrl.trim() && !selectedSignatureFile) {
      fields.push('firma')
    }

    return fields
  }, [formData.address, formData.contactEmail, formData.phone, formData.professionalName, formData.signatureUrl, selectedSignatureFile])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleResetGoogleData = () => {
    setFormData((current) => ({
      ...current,
      professionalName: user.name || '',
      contactEmail: user.email || '',
    }))
  }

  const handleSelectSignatureFile = (file) => {
    const validationMessage = validateImageFile(file)

    if (validationMessage) {
      setSignatureUploadError(validationMessage)
      setSelectedSignatureFile(null)
      return
    }

    setSignatureUploadError('')
    setSelectedSignatureFile(file)
  }

  const uploadSignature = async (file) => {
    const folder = `factory-manager/profiles/${user.uid}`
    const uploadedFile = await uploadImageToCloudinary(file, folder)

    return {
      signatureUrl: uploadedFile.url,
      signaturePublicId: uploadedFile.publicId,
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setSaving(true)
    setErrorMessage('')

    try {
      if (selectedSignatureFile && !hasCloudinaryConfig()) {
        throw new Error(getCloudinaryConfigError())
      }

      const profileRef = doc(db, 'userProfiles', user.uid)
      let uploadedSignature = null

      if (selectedSignatureFile) {
        uploadedSignature = await uploadSignature(selectedSignatureFile)
      }

      const payload = {
        professionalName: formData.professionalName.trim(),
        contactEmail: formData.contactEmail.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        signatureUrl: uploadedSignature?.signatureUrl || formData.signatureUrl.trim(),
        ...(uploadedSignature ? { signaturePublicId: uploadedSignature.signaturePublicId } : {}),
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
      }

      await setDoc(
        profileRef,
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )

      if (uploadedSignature) {
        setFormData((current) => ({
          ...current,
          signatureUrl: uploadedSignature.signatureUrl,
        }))
      }

      setSelectedSignatureFile(null)

      notify?.({
        message: 'Perfil profesional guardado correctamente.',
        tone: 'success',
      })
    } catch (error) {
      console.error('Error al guardar perfil de usuario:', error)
      setErrorMessage(error?.message || 'No se pudo guardar el perfil.')
      notify?.({
        message: error?.message || 'No se pudo guardar el perfil.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-manager" aria-label="Perfil profesional">
      <header className="profile-manager-header">
        <h2>Mi perfil</h2>
        <p>
          Estos datos se usan automaticamente en el presupuestador y en el PDF generado.
        </p>
      </header>

      {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}

      {loading ? <p>Cargando perfil...</p> : null}

      {!loading ? (
        <>
          {missingFields.length > 0 ? (
            <p className="profile-warning">
              Faltan datos obligatorios para presupuestos completos: {missingFields.join(', ')}.
            </p>
          ) : null}

          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="profile-field">
              <label htmlFor="profile-professional-name">Profesional</label>
              <input
                id="profile-professional-name"
                name="professionalName"
                value={formData.professionalName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-email">Email de contacto</label>
              <input
                id="profile-email"
                type="email"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                required
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-phone">Telefono / WhatsApp</label>
              <input
                id="profile-phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="profile-field profile-field--full">
              <label htmlFor="profile-address">Direccion</label>
              <input
                id="profile-address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="profile-field profile-field--full">
              <label htmlFor="profile-signature-file">Firma profesional (JPG, PNG o WEBP)</label>
              <div
                className={`profile-upload-dropzone${isSignatureDragActive ? ' profile-upload-dropzone--active' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsSignatureDragActive(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsSignatureDragActive(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsSignatureDragActive(false)
                  const droppedFile = event.dataTransfer.files?.[0]
                  handleSelectSignatureFile(droppedFile)
                }}
              >
                <input
                  id="profile-signature-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleSelectSignatureFile(event.target.files?.[0])}
                />
                <p>
                  {selectedSignatureFile
                    ? `Archivo seleccionado: ${selectedSignatureFile.name}`
                    : 'Arrastra una imagen aqui o selecciona un archivo'}
                </p>
                <small>
                  {formData.signatureUrl
                    ? 'Ya existe una firma guardada. Si subes una nueva se reemplaza.'
                    : 'Sin firma cargada actualmente.'}
                </small>
              </div>
              {signatureUploadError ? <p className="profile-upload-error">{signatureUploadError}</p> : null}
            </div>

            <div className="profile-actions">
              <button type="button" className="profile-secondary" onClick={handleResetGoogleData}>
                Restaurar nombre/email de Google
              </button>
              <button type="submit" className="profile-submit" disabled={saving}>
                {saving ? <span className="ui-inline-loader">Guardando...</span> : 'Guardar perfil'}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  )
}

export default ProfileManager
