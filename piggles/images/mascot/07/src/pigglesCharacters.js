export const pigglesCharacterIds = [
  'piggles-bakery',
  'piggles-barber',
  'piggles-potter',
  'piggles-garage',
  'piggles-market-stall',
  'piggles-salon',
  'piggles-tailor',
  'piggles-art-studio',
  'piggles-workshop',
  'piggles-supplier',
  'piggles-shed',
];

export const pigglesCharacters = Object.freeze(
  Object.fromEntries(
    pigglesCharacterIds.map((id) => [
      id,
      { id, png: `assets/png/${id}.png`, webp: `assets/webp/${id}.webp` },
    ]),
  ),
);

export function getPigglesCharacter(id, format = 'webp') {
  const asset = pigglesCharacters[id];
  if (!asset) throw new Error(`Unknown Piggles character: ${id}`);
  if (format !== 'png' && format !== 'webp') {
    throw new Error(`Unsupported Piggles format: ${format}`);
  }
  return asset[format];
}
