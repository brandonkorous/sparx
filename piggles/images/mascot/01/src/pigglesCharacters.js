export const pigglesCharacterIds = [
  'piggles-mascot-base',
  'piggles-planner',
  'piggles-analyst',
  'piggles-communicator',
  'piggles-builder',
  'piggles-protector',
  'piggles-money-minder',
  'piggles-organizer',
  'piggles-cheerleader',
  'piggles-sidekick',
];
export const pigglesCharacters = Object.freeze(
  Object.fromEntries(
    pigglesCharacterIds.map((id) => [
      id,
      { id, png: `assets/png/${id}.png`, webp: `assets/webp/${id}.webp` },
    ])
  )
);
export function getPigglesCharacter(id, format = 'webp') {
  const asset = pigglesCharacters[id];
  if (!asset) throw new Error(`Unknown Piggles character: ${id}`);
  if (format !== 'png' && format !== 'webp')
    throw new Error(`Unsupported Piggles format: ${format}`);
  return asset[format];
}
