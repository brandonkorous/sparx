export type PigglesCharacterId =
  | 'piggles-desk-workspace'
  | 'piggles-desktop-computer'
  | 'piggles-front-counter'
  | 'piggles-retail-shop'
  | 'piggles-workshop'
  | 'piggles-food-truck'
  | 'piggles-salon-station'
  | 'piggles-home-office'
  | 'piggles-meeting-table'
  | 'piggles-shipping-station';

export type PigglesImageFormat = 'png' | 'webp';
export interface PigglesCharacterAsset {
  id: PigglesCharacterId;
  png: string;
  webp: string;
}

export declare const pigglesCharacterIds: readonly PigglesCharacterId[];
export declare const pigglesCharacters: Readonly<Record<PigglesCharacterId, PigglesCharacterAsset>>;
export declare function getPigglesCharacter(id: PigglesCharacterId, format?: PigglesImageFormat): string;
