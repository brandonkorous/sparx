export type PigglesCharacterId =
  | 'piggles-laptop-focus'
  | 'piggles-laptop-coffee'
  | 'piggles-video-call'
  | 'piggles-email-desk'
  | 'piggles-reports-desk'
  | 'piggles-calendar-desk'
  | 'piggles-tablet-desk'
  | 'piggles-phone-desk'
  | 'piggles-orders-desk'
  | 'piggles-desk-celebrate';

export type PigglesImageFormat = 'png' | 'webp';
export interface PigglesCharacterAsset {
  id: PigglesCharacterId;
  png: string;
  webp: string;
}

export declare const pigglesCharacterIds: readonly PigglesCharacterId[];
export declare const pigglesCharacters: Readonly<Record<PigglesCharacterId, PigglesCharacterAsset>>;
export declare function getPigglesCharacter(id: PigglesCharacterId, format?: PigglesImageFormat): string;
