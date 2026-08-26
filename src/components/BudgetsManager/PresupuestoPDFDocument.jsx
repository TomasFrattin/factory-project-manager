import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.2,
  },
  sectionTitle: {
    backgroundColor: '#E7E7E7',
    borderWidth: 1,
    borderColor: '#000000',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    paddingTop: 2,
    paddingRight: 4,
    paddingBottom: 2,
    paddingLeft: 4,
    marginBottom: 5,
  },
  detailRows: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    width: 112,
    fontFamily: 'Helvetica-Bold',
  },
  value: {
    flex: 1,
  },
  valueBold: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
  },
  clientSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clientDetails: {
    width: '68%',
  },
  logoContainer: {
    width: '30%',
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 4,
    paddingLeft: 4,
  },
  logo: {
    width: '100%',
    maxHeight: 92,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    fontSize: 8,
    color: '#666666',
    textAlign: 'center',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EFEFEF',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 18,
    alignItems: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    minHeight: 17,
    alignItems: 'center',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colItem: {
    width: '17%',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 3,
  },
  colDesc: {
    width: '44%',
    textAlign: 'left',
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    paddingRight: 3,
  },
  colHs: {
    width: '7%',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 3,
  },
  colPrice: {
    width: '16%',
    textAlign: 'right',
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 4,
  },
  colSubtotal: {
    width: '16%',
    textAlign: 'right',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 3,
    paddingRight: 4,
  },
  totalsWrap: {
    alignItems: 'flex-end',
    marginTop: 3,
    marginBottom: 8,
  },
  totalRow: {
    width: '42%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
  },
  notes: {
    fontSize: 8,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  conditionsWrap: {
    marginTop: 7,
    marginBottom: 8,
  },
  signatures: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureColumn: {
    width: '42%',
    display: 'flex',
    flexDirection: 'column',
  },
  signatureTitle: {
    marginBottom: 6,
    fontSize: 10,
  },
  signatureAssetSlot: {
    height: 40,
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderColor: '#000000',
    minHeight: 1,
  },
  signatureImage: {
    width: 130,
    height: 40,
    objectFit: 'contain',
    marginBottom: -6,
  },
})

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const formatArs = (value) => {
  const parsed = toNumber(value)

  if (parsed === null) {
    return '$ 0,00'
  }

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed)
}

const formatHours = (value) => {
  const parsed = toNumber(value)

  if (parsed === null) {
    return '-'
  }

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed)
}

const normalizeText = (value, fallback = '-') => {
  const text = String(value || '').trim()
  return text || fallback
}

export function PresupuestoPDFDocument({
  profesional,
  cliente,
  items,
  condiciones,
  totales,
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>DATOS PROFESIONAL</Text>
        <View style={styles.detailRows}>
          <View style={styles.row}>
            <Text style={styles.label}>Profesional:</Text>
            <Text style={styles.valueBold}>{normalizeText(profesional.nombre)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefono / WhatsApp:</Text>
            <Text style={styles.value}>{normalizeText(profesional.telefono)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{normalizeText(profesional.email)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Direccion:</Text>
            <Text style={styles.value}>{normalizeText(profesional.direccion)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha del presupuesto:</Text>
            <Text style={styles.value}>{normalizeText(profesional.fecha)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>N de presupuesto:</Text>
            <Text style={styles.value}>{normalizeText(profesional.numero)}</Text>
          </View>
        </View>

        <View style={styles.clientSection}>
          <View style={styles.clientDetails}>
            <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Cliente / Empresa:</Text>
              <Text style={styles.valueBold}>{normalizeText(cliente.nombre)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Telefono:</Text>
              <Text style={styles.value}>{normalizeText(cliente.telefono)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Direccion:</Text>
              <Text style={styles.value}>{normalizeText(cliente.direccion)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Contacto:</Text>
              <Text style={styles.value}>{normalizeText(cliente.contacto)}</Text>
            </View>
          </View>

          <View style={styles.logoContainer}>
            {cliente.logoUrl ? (
              <Image src={cliente.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.logoPlaceholder}>Logo cliente</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>DESCRIPCION DEL TRABAJO</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colDesc}>Descripcion detallada del trabajo</Text>
            <Text style={styles.colHs}>Hs</Text>
            <Text style={styles.colPrice}>Precio Unitario (ARS)</Text>
            <Text style={styles.colSubtotal}>Subtotal (ARS)*</Text>
          </View>
          {items.map((item, index) => (
            <View
              style={[
                styles.tableRow,
                index === items.length - 1 ? styles.tableRowLast : null,
              ]}
              key={item.id || `item-${index}`}
            >
              <Text style={styles.colItem}>{index + 1}</Text>
              <Text style={styles.colDesc}>{normalizeText(item.descripcion)}</Text>
              <Text style={styles.colHs}>{formatHours(item.horas)}</Text>
              <Text style={styles.colPrice}>$ {formatArs(item.precioUnitario)}</Text>
              <Text style={styles.colSubtotal}>$ {formatArs(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>$ {formatArs(totales.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA ({normalizeText(totales.ivaLabel, '0%')})</Text>
            <Text style={styles.totalValue}>$ {formatArs(totales.iva)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Presupuesto (ARS)</Text>
            <Text style={styles.totalValue}>$ {formatArs(totales.total)}</Text>
          </View>
        </View>

        <Text style={styles.notes}>
          *Precios expresados en ARS, equivalentes a valores en USD segun cotizacion vendedor BNA actualizada a la fecha del presupuesto.
        </Text>

        <View style={styles.conditionsWrap}>
          <Text style={styles.sectionTitle}>CONDICIONES COMERCIALES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Forma de pago:</Text>
            <Text style={styles.value}>{normalizeText(condiciones.formaPago)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Validez del presupuesto:</Text>
            <Text style={styles.value}>{normalizeText(condiciones.validez)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plazo de entrega:</Text>
            <Text style={styles.value}>{normalizeText(condiciones.plazoEntrega)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Forma de entrega:</Text>
            <Text style={styles.value}>{normalizeText(condiciones.formaEntrega)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Observaciones:</Text>
            <Text style={styles.value}>{normalizeText(condiciones.observaciones)}</Text>
          </View>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureTitle}>Firma Cliente:</Text>
            <View style={styles.signatureAssetSlot} />
            <View style={styles.signatureLine} />
          </View>

          <View style={styles.signatureColumn}>
            <Text style={styles.signatureTitle}>Firma Profesional:</Text>
            <View style={styles.signatureAssetSlot}>
              {profesional.firmaUrl ? <Image src={profesional.firmaUrl} style={styles.signatureImage} /> : null}
            </View>
            <View style={styles.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
