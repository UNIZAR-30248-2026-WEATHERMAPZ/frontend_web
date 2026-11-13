const CONDITIONS = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Cubierto',
  45: 'Niebla',
  48: 'Niebla engelante',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna intensa',
  56: 'Llovizna engelante ligera',
  57: 'Llovizna engelante intensa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  66: 'Lluvia engelante ligera',
  67: 'Lluvia engelante intensa',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos intensos',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve intensos',
  95: 'Tormenta',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo intenso',
};

export function getWeatherDescription(code) {
  return Number.isInteger(code)
    ? CONDITIONS[code] || 'Estado del cielo no disponible'
    : 'Estado del cielo no disponible';
}

const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function getWindDirectionLabel(degrees) {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees > 360) return null;
  return COMPASS_DIRECTIONS[Math.round(degrees / 45) % COMPASS_DIRECTIONS.length];
}
