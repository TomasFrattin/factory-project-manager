import { es } from 'date-fns/locale'

const capitalizeLabel = (value) => {
  if (!value) {
    return value
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

export const spanishDayPickerLocale = es

export const spanishDayPickerFormatters = {
  formatCaption: (month) =>
    capitalizeLabel(
      new Intl.DateTimeFormat('es-AR', {
        month: 'long',
        year: 'numeric',
      }).format(month),
    ),
  formatWeekdayName: (weekday) =>
    capitalizeLabel(
      new Intl.DateTimeFormat('es-AR', {
        weekday: 'short',
      }).format(weekday),
    ),
}
