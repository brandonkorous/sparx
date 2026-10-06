// The tax rate, as an owner says it.
//
// Nobody knows their tax rate as "0.0875". The box asked for exactly that, with
// "As a decimal: 0.0875 is 8.75%" under it, so the number on every invoice was
// one slip of a decimal point from a hundred times too much (sparx persona issue
// 077). The box takes "8.75" now; the document still stores the fraction, and
// the conversion happens here, once.

/** The stored fraction as the box shows it: 0.0875 reads "8.75", 0 reads "0". */
export function percentText(rate: number): string {
  return String(Number((rate * 100).toFixed(4)));
}

/**
 * What was typed, as the stored fraction, or null when it is not a rate.
 *
 * A trailing "%" is allowed because people type one. An empty box is 0, no tax:
 * clearing it is how somebody says they charge none.
 */
export function parsePercent(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, '').trim();
  if (cleaned === '') return 0;
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > 100) return null;
  return Number((value / 100).toFixed(6));
}
