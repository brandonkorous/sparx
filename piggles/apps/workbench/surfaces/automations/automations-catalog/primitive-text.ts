/** Render an unknown config/condition value as display text without tripping
 *  `no-base-to-string`: primitives stringify, objects/arrays serialize as JSON. */
export function primitiveText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}
