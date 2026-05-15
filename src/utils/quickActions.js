export const QUICK_ACTIONS = [
  {
    id: 'scan',
    icon: '📷',
    label: 'Scan talon',
    description: 'OCR și documente',
    route: 'Camera',
  },
  {
    id: 'addInvoice',
    icon: '🧾',
    label: 'Factură',
    description: 'Cheltuială nouă',
    route: 'AddInvoice',
    requiresVehicle: true,
  },
  {
    id: 'addFuel',
    icon: '⛽',
    label: 'Alimentare',
    description: 'Log combustibil',
    route: 'AddFuel',
    requiresVehicle: true,
  },
  {
    id: 'documents',
    icon: '📁',
    label: 'Documente',
    description: 'Acte și fișiere',
    route: 'Documents',
  },
  {
    id: 'calendar',
    icon: '📅',
    label: 'Calendar',
    description: 'Termene active',
    route: 'Calendar',
  },
  {
    id: 'addReminder',
    icon: '⏱',
    label: 'Reminder',
    description: 'Alertă nouă',
    route: 'AddReminder',
    requiresVehicle: false,
  },
  {
    id: 'fuelLog',
    icon: '📈',
    label: 'Consum',
    description: 'Istoric alimentări',
    route: 'FuelLog',
  },
  {
    id: 'services',
    icon: '🧭',
    label: 'Service',
    description: 'Caută aproape',
    route: 'Services',
  },
  {
    id: 'ai',
    icon: '🤖',
    label: 'AI',
    description: 'Asistent auto',
    route: 'AIChat',
  },
  {
    id: 'search',
    icon: '🔎',
    label: 'Caută',
    description: 'În toată aplicația',
    route: 'Search',
  },
  {
    id: 'friends',
    icon: '👥',
    label: 'Prieteni',
    description: 'Acces partajat',
    route: 'Friends',
  },
  {
    id: 'addVehicle',
    icon: '➕',
    label: 'Vehicul',
    description: 'Adaugă nou',
    route: 'AddVehicle',
  },
];

export const DEFAULT_QUICK_ACTION_IDS = [
  'scan',
  'addInvoice',
  'addFuel',
  'documents',
  'calendar',
  'ai',
];

export const MAX_HOME_QUICK_ACTIONS = 8;

export function getQuickActionById(id) {
  return QUICK_ACTIONS.find(action => action.id === id);
}

export function normalizeQuickActionIds(ids) {
  const known = new Set(QUICK_ACTIONS.map(action => action.id));
  const unique = [];

  for (const id of ids || []) {
    if (known.has(id) && !unique.includes(id)) unique.push(id);
  }

  return unique.length ? unique.slice(0, MAX_HOME_QUICK_ACTIONS) : DEFAULT_QUICK_ACTION_IDS;
}
