export type PigglesCharacterId='piggles-mascot-base'|'piggles-planner'|'piggles-analyst'|'piggles-communicator'|'piggles-builder'|'piggles-protector'|'piggles-money-minder'|'piggles-organizer'|'piggles-cheerleader'|'piggles-sidekick';
export type PigglesFormat='png'|'webp';
export interface PigglesAsset{id:PigglesCharacterId;png:string;webp:string;}
export const pigglesCharacterIds:PigglesCharacterId[];
export const pigglesCharacters:Readonly<Record<PigglesCharacterId,PigglesAsset>>;
export function getPigglesCharacter(id:PigglesCharacterId,format?:PigglesFormat):string;
