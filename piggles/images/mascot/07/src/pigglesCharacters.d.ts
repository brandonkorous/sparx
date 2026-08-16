export type PigglesCharacterId =
  | 'piggles-bakery'
  | 'piggles-barber'
  | 'piggles-potter'
  | 'piggles-garage'
  | 'piggles-market-stall'
  | 'piggles-salon'
  | 'piggles-tailor'
  | 'piggles-art-studio'
  | 'piggles-workshop'
  | 'piggles-supplier'
  | 'piggles-shed';

export type PigglesImageFormat = 'png' | 'webp';

export interface PigglesCharacterAsset {
  id: PigglesCharacterId;
  png: string;
  webp: string;
}

export declare const pigglesCharacterIds: readonly PigglesCharacterId[];
export declare const pigglesCharacters: Readonly<Record<PigglesCharacterId, PigglesCharacterAsset>>;
export declare function getPigglesCharacter(id: PigglesCharacterId, format?: PigglesImageFormat): string;
