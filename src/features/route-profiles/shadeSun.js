// Shade and sun are the two ends of one scale (ADR-030): -100 is all shade, 0 neutral and 100 all
// sun. The API keeps two weights, `shade` and `sun`, and at most one of them is above 0.

export const SHADE_SUN_MAX = 100;
export const SHADE_SUN_STEP = 5;

// A route saved before both could be set at once: the larger one wins, and equal ones cancel out
// (as they did in the cost, ADR-023).
export function shadeSunBalance({ shade = 0, sun = 0 } = {}) {
  if (shade > sun) return -shade;
  if (sun > shade) return sun;
  return 0;
}

export function weightsFromBalance(balance) {
  return { shade: balance < 0 ? -balance : 0, sun: balance > 0 ? balance : 0 };
}

// Which side of the scale a value is on: 'shade', 'sun' or 'neutral'.
export function balanceSide(balance) {
  if (balance < 0) return 'shade';
  if (balance > 0) return 'sun';
  return 'neutral';
}

export function balanceText(balance) {
  if (balance < 0) return `Sombra ${-balance} %`;
  if (balance > 0) return `Sol ${balance} %`;
  return 'Neutro';
}
