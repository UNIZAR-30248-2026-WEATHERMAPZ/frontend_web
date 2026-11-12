import {
  RESERVED_NAME_MESSAGE,
  findNameConflict,
  isReservedName,
  suggestFreeName,
} from './profileNames.js';

const profiles = [
  { id: 'recommended', name: 'Recomendada', readOnly: true },
  { id: 1, name: 'Rápida' },
  { id: 2, name: 'Verano' },
  { id: 3, name: 'Verano (2)' },
];

describe('names of the saved routes (#165)', () => {
  it('finds the route with the same name, without case or surrounding spaces', () => {
    expect(findNameConflict(profiles, '  VERANO ')).toMatchObject({ id: 2 });
    // Not the route being edited, nor the recommended one, nor a different accent.
    expect(findNameConflict(profiles, 'verano', 2)).toBeNull();
    expect(findNameConflict(profiles, 'Rapida')).toBeNull();
    expect(findNameConflict(profiles, '   ')).toBeNull();
  });

  it('reserves "Recomendada"', () => {
    expect(isReservedName(' recomendada ')).toBe(true);
    expect(isReservedName('Recomendada 2')).toBe(false);
    expect(RESERVED_NAME_MESSAGE).toBe('«Recomendada» es la ruta automática: elige otro nombre.');
  });

  it('suggests the first free "X (n)" within 40 characters', () => {
    expect(suggestFreeName('Rápida', profiles)).toBe('Rápida (2)');
    expect(suggestFreeName(' verano ', profiles)).toBe('verano (3)');
    expect(suggestFreeName('Verano (2)', profiles)).toBe('Verano (3)');
    const long = 'Paseo largo por la ribera del Ebro norte';
    expect(suggestFreeName(long, [{ id: 4, name: long }])).toBe(
      'Paseo largo por la ribera del Ebro n (2)'
    );
  });
});
