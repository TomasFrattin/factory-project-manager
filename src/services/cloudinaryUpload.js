const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const validateImageFile = (file) => {
  if (!file) {
    return 'No se detecto ningun archivo.'
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Formato invalido. Solo se permiten JPG, PNG o WEBP.'
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'El archivo supera 2 MB. Reduce el tamano e intenta nuevamente.'
  }

  return ''
}

export const hasCloudinaryConfig = () => {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
}

export const getCloudinaryConfigError = () => {
  if (hasCloudinaryConfig()) {
    return ''
  }

  return 'Falta configurar Cloudinary (.env: VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET).'
}

export const uploadImageToCloudinary = async (file, folder = 'factory-manager') => {
  if (!hasCloudinaryConfig()) {
    throw new Error(getCloudinaryConfigError())
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', folder)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Cloudinary error: ${errorBody || response.status}`)
  }

  const result = await response.json()

  return {
    url: String(result.secure_url || ''),
    publicId: String(result.public_id || ''),
  }
}
