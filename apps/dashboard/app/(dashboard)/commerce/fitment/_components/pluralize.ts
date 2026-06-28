// English pluralization for fitment labels — the count chips and inline copy
// render a label per vertical (Make → makes, Species → species, Class →
// classes, Family → families, Category → categories). A naive `${word}s`
// produces "speciess" / "classs" / "categorys", so this covers the regular
// cases plus the suffix + irregular rules the dictionary labels actually hit.
// Callers pass the singular label already lowercased at the call site.

const IRREGULAR: Record<string, string> = {
  species: 'species',
};

export function pluralizeLabel(word: string, count: number): string {
  if (count === 1) return word;
  const lower = word.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  // consonant + y → ies (family → families, category → categories)
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  // sibilants s, x, z, ch, sh → es (class → classes, box → boxes)
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}
