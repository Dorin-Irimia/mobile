export const VEHICLE_CATEGORIES = [
  { key: 'masina',      label: 'Mașină',     icon: '🚗' },
  { key: 'motocicleta', label: 'Motocicletă', icon: '🏍️' },
  { key: 'camion',      label: 'Camion',      icon: '🚛' },
  { key: 'tractor',     label: 'Tractor',     icon: '🚜' },
  { key: 'autobuz',     label: 'Autobuz',     icon: '🚌' },
  { key: 'barca',       label: 'Barcă',       icon: '⛵' },
  { key: 'bicicleta',   label: 'Bicicletă',   icon: '🚲' },
  { key: 'remorca',      label: 'Remorcă',     icon: '🚚' },
];

export function getVehicleIcon(category) {
  const cat = VEHICLE_CATEGORIES.find(c => c.key === category);
  return cat ? cat.icon : '🚗';
}
