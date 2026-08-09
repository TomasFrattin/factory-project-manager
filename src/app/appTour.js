const baseSteps = [
  {
    target: '[data-tour="side-nav"]',
    content:
      'Este es el panel principal de navegacion. Desde aqui te mueves por todos los modulos.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-home"]',
    content: 'Home muestra un resumen rapido: cotizacion, urgentes y pendientes de cobro.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-projects"]',
    content: 'En Proyectos puedes crear, editar y cerrar proyectos.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-clients"]',
    content: 'En Clientes gestionas la base de clientes para asociarlos a proyectos.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-factory-hours"]',
    content: 'Horas fabrica sirve para registrar horas y costos operativos.',
    placement: 'right',
  },
]

const pageStepsByPath = {
  '/home': [
    {
      target: '[data-tour="home-usd-panel"]',
      content: 'Aqui ves la cotizacion del dolar BNA, usada como referencia rapida.',
    },
    {
      target: '[data-tour="home-urgent-panel"]',
      content: 'Este bloque concentra proyectos urgentes para seguimiento diario.',
    },
    {
      target: '[data-tour="home-unpaid-panel"]',
      content: 'Aqui aparecen proyectos pendientes de cobro para control financiero.',
    },
  ],
  '/projects': [
    {
      target: '[data-tour="projects-create-button"]',
      content:
        'Comienza por aqui para crear un proyecto. Si no hay clientes, se bloquea el alta y se informa el motivo.',
    },
    {
      target: '[data-tour="projects-table"]',
      content:
        'La tabla lista estado, horas, cotizacion, total y acceso rapido a editar o eliminar.',
    },
  ],
  '/clients': [
    {
      target: '[data-tour="clients-create-button"]',
      content: 'Primero crea clientes aqui; luego podras asignarlos a proyectos.',
    },
    {
      target: '[data-tour="clients-table"]',
      content: 'Desde la tabla gestionas clientes existentes con editar y eliminar.',
    },
  ],
  '/factory-hours': [
    {
      target: '[data-tour="factory-hours-create-button"]',
      content: 'Usa este boton para registrar una nueva jornada de horas de fabrica.',
    },
    {
      target: '[data-tour="factory-hours-table"]',
      content:
        'Aqui ves horas, cotizacion y total en ARS. Sirve para control historico de costos.',
    },
  ],
}

export const getTourSteps = (pathname) => {
  const pageSteps = pageStepsByPath[pathname] || []

  return [
    ...baseSteps,
    ...pageSteps,
    {
      target: '[data-tour="tour-launcher"]',
      content:
        'Puedes relanzar este tutorial cuando quieras desde este boton flotante.',
      placement: 'left',
    },
  ]
}
