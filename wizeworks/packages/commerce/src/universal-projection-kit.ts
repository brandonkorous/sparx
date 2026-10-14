// The small helpers every universal-search projector file shares (persona issue 261).
//
// `universal-projection.ts` keeps its own private copies; this is the shared set
// for the projector files added beside it, so four files do not grow four copies.

/** Epoch seconds, or 0 for a missing date. */
export function epoch(d: Date | null | undefined): number {
  return d ? Math.floor(d.getTime() / 1000) : 0;
}

/** Drop nullish/empty entries; undefined when nothing is left, so the optional
 *  Typesense field is omitted rather than stored as `[]`. */
export function keywords(values: (string | null | undefined)[]): string[] | undefined {
  const out = values
    .map((v) => v?.trim())
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? Array.from(new Set(out)) : undefined;
}

/** Cap free text so the index stays lean; undefined for blank text. */
export function snippet(s: string | null | undefined, max = 2000): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** A trimmed non-empty string out of an untyped JSON value, else undefined. */
export function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** The string entries of an untyped JSON array, else []. */
export function pickStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(pickString).filter((s): s is string => s !== undefined) : [];
}

/** "Alpha, Beta and Gamma": a short list read the way a person says it. */
export function listWords(items: string[], most = 3): string | undefined {
  const shown = items.slice(0, most);
  if (shown.length === 0) return undefined;
  const rest = items.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${String(rest)} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1] ?? ''}`;
}

/** A plain number without the trailing zeros a Decimal column prints: 12.5, not 12.5000. */
export function plainNumber(value: { toString(): string } | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const n = Number(value.toString());
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : value.toString();
}
