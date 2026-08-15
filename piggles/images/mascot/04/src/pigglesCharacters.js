export const pigglesCharacterIds = [
  'piggles-desk-workspace',
  'piggles-desktop-computer',
  'piggles-front-counter',
  'piggles-retail-shop',
  'piggles-workshop',
  'piggles-food-truck',
  'piggles-salon-station',
  'piggles-home-office',
  'piggles-meeting-table',
  'piggles-shipping-station',
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
