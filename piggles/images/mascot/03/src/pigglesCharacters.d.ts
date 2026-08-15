export type PigglesCharacterId = 'piggles-empty'|'piggles-error'|'piggles-loading'|'piggles-no-results'|'piggles-upload'|'piggles-download'|'piggles-security'|'piggles-support'|'piggles-maintenance'|'piggles-announcement';
export type PigglesFormat='png'|'webp';
export interface PigglesAsset{id:PigglesCharacterId;png:string;webp:string;}
export const pigglesCharacterIds:PigglesCharacterId[];
export const pigglesCharacters:Readonly<Record<PigglesCharacterId,PigglesAsset>>;
export function getPigglesCharacter(id:PigglesCharacterId,format?:PigglesFormat):string;
