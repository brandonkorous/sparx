export type PigglesCharacterId =
  | 'piggles-point-right'
  | 'piggles-coffee'
  | 'piggles-phone'
  | 'piggles-package'
  | 'piggles-thumbs-up'
  | 'piggles-checklist'
  | 'piggles-chart'
  | 'piggles-welcome-sign'
  | 'piggles-mail'
  | 'piggles-idea';

export type PigglesFormat = 'png' | 'webp';
export interface PigglesAsset { id: PigglesCharacterId; png: string; webp: string; }
export const pigglesCharacterIds: PigglesCharacterId[];
export const pigglesCharacters: Readonly<Record<PigglesCharacterId, PigglesAsset>>;
export function getPigglesCharacter(id: PigglesCharacterId, format?: PigglesFormat): string;
