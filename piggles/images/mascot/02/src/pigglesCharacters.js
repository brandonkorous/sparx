export const pigglesCharacterIds = [
  'piggles-point-right',
  'piggles-coffee',
  'piggles-phone',
  'piggles-package',
  'piggles-thumbs-up',
  'piggles-checklist',
  'piggles-chart',
  'piggles-welcome-sign',
  'piggles-mail',
  'piggles-idea',
];

export const pigglesCharacters = Object.freeze(
  Object.fromEntries(pigglesCharacterIds.map((id) => [id, {
    id,
    png: `assets/png/${id}.png`,
    webp: `assets/webp/${id}.webp`,
  }]))
);

export function getPigglesCharacter(id, format = 'webp') {
  const character = pigglesCharacters[id];
  if (!character) throw new Error(`Unknown Piggles character: ${id}`);
  if (format !== 'png' && format !== 'webp') throw new Error(`Unsupported Piggles format: ${format}`);
  return character[format];
}
