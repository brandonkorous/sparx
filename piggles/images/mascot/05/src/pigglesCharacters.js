export const pigglesCharacterIds = [
  'piggles-laptop-focus',
  'piggles-laptop-coffee',
  'piggles-video-call',
  'piggles-email-desk',
  'piggles-reports-desk',
  'piggles-calendar-desk',
  'piggles-tablet-desk',
  'piggles-phone-desk',
  'piggles-orders-desk',
  'piggles-desk-celebrate',
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
