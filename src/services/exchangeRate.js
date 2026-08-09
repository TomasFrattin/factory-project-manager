const DOLAR_API_OFICIAL_URL = 'https://dolarapi.com/v1/dolares/oficial'
const AMBITO_BNA_URL = 'https://mercados.ambito.com/dolar/bna/variacion'

const parseRate = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).replace(',', '.').trim()
  const numericValue = Number.parseFloat(normalized)

  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(2)) : null
}

export const getOfficialUsdRate = async () => {
  const response = await fetch(DOLAR_API_OFICIAL_URL)

  if (!response.ok) {
    throw new Error(`No se pudo obtener la cotizacion. HTTP ${response.status}`)
  }

  const payload = await response.json()
  const rate = Number(payload.venta)

  if (!Number.isFinite(rate)) {
    throw new Error('La API devolvio una cotizacion invalida.')
  }

  return {
    rate: Number(rate.toFixed(2)),
    updatedAt: payload.fechaActualizacion || null,
    source: DOLAR_API_OFICIAL_URL,
  }
}

export const getBnaUsdRate = async () => {
  try {
    const response = await fetch(AMBITO_BNA_URL)

    if (!response.ok) {
      throw new Error(`No se pudo obtener cotizacion BNA. HTTP ${response.status}`)
    }

    const payload = await response.json()
    const buy = parseRate(payload.compra)
    const sell = parseRate(payload.venta)

    if (buy === null || sell === null) {
      throw new Error('La API de BNA devolvio valores invalidos.')
    }

    return {
      buy,
      sell,
      updatedAt: payload.fecha || null,
      source: AMBITO_BNA_URL,
    }
  } catch (error) {
    const fallback = await getOfficialUsdRate()

    return {
      buy: fallback.rate,
      sell: fallback.rate,
      updatedAt: fallback.updatedAt,
      source: fallback.source,
    }
  }
}