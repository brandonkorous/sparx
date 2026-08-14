import React from "react";
import { getPigglesCharacter } from "./pigglesCharacters";

export function PigglesCharacter({
  id = "neutral",
  alt,
  className = "",
  loading = "lazy",
  ...props
}) {
  const character = getPigglesCharacter(id);
  return (
    <img
      src={character.src}
      alt={alt ?? character.alt}
      loading={loading}
      className={className}
      {...props}
    />
  );
}
