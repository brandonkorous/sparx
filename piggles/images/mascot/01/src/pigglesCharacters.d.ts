export type PigglesCharacterId =
  | "neutral"
  | "wave"
  | "laptop"
  | "desk"
  | "thinking"
  | "celebrate"
  | "point-left"
  | "invoice"
  | "calendar"
;

export type PigglesCharacter = {
  src: string;
  alt: string;
  category: string;
};

export declare const PIGGLES_BASE_URL: string;
export declare const pigglesCharacters: Record<PigglesCharacterId, PigglesCharacter>;
export declare function getPigglesCharacter(id?: PigglesCharacterId): PigglesCharacter;
export declare function getPigglesByIntent(intent: string): PigglesCharacter;
