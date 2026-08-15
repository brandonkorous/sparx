import React from 'react';
import { getPigglesCharacter } from './pigglesCharacters';
export function PigglesCharacter({id,format='webp',basePath='',alt='',loading='lazy',decoding='async',...imgProps}){const relativePath=getPigglesCharacter(id,format);const src=[basePath.replace(/\/$/,''),relativePath].filter(Boolean).join('/');return <img src={src} alt={alt} loading={loading} decoding={decoding} {...imgProps}/>;}
export default PigglesCharacter;
