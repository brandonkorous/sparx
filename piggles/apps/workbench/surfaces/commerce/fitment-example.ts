/** Examples for the add box, each with the parent it belongs under. An example is
 *  only shown under that parent: "F-250 Super Duty" under GMC, or "6.7L Power
 *  Stroke" under a Jeep, taught the owner the wrong thing (sparx persona issue 067). */
const EXAMPLES: Record<string, { example: string; under?: string }> = {
  Make: { example: 'Ford' },
  Model: { example: 'F-250 Super Duty', under: 'Ford' },
  Engine: { example: '6.7L Power Stroke', under: 'F-250 Super Duty' },
  Brand: { example: 'Apple' },
  Size: { example: 'Large' },
  Species: { example: 'Dog' },
  Breed: { example: 'Labrador Retriever', under: 'Dog' },
  Department: { example: "Men's" },
  Discipline: { example: 'Road' },
};

/** A concrete, on-topic example for the add box, so an empty field is not a blank
 *  stare. Elsewhere it names the parent ("GMC model"), never another one's child. */
export function placeholderFor(levelLabel: string, parentName?: string): string {
  const known = EXAMPLES[levelLabel];
  if (known && (known.under === undefined || known.under === parentName)) return known.example;
  const level = levelLabel.toLowerCase();
  if (parentName) return `${parentName} ${level}`;
  return `${/^[aeiou]/i.test(level) ? 'An' : 'A'} ${level}`;
}
