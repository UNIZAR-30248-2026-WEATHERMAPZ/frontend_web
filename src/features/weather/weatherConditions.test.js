import { getWeatherDescription, getWindDirectionLabel } from './weatherConditions.js';

describe('weather display helpers', () => {
  it('translates supported WMO weather codes into Spanish conditions', () => {
    expect(getWeatherDescription(0)).toBe('Despejado');
    expect(getWeatherDescription(3)).toBe('Cubierto');
    expect(getWeatherDescription(61)).toBe('Lluvia ligera');
    expect(getWeatherDescription(95)).toBe('Tormenta');
  });

  it('states clearly when the provider has no known sky condition', () => {
    expect(getWeatherDescription(null)).toBe('Estado del cielo no disponible');
    expect(getWeatherDescription(999)).toBe('Estado del cielo no disponible');
  });

  it('converts wind bearing into a compass direction', () => {
    expect(getWindDirectionLabel(0)).toBe('N');
    expect(getWindDirectionLabel(240)).toBe('SO');
    expect(getWindDirectionLabel(360)).toBe('N');
    expect(getWindDirectionLabel(null)).toBeNull();
  });
});
