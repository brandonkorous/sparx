import React from 'react';
import { getPigglesCharacter } from './pigglesCharacters.js';

export function PigglesCharacter({ id, format = 'webp', alt = '', ...imgProps }) {
  return <img src={getPigglesCharacter(id, format)} alt={alt} {...imgProps} />;
}
