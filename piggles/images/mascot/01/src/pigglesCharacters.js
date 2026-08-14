// Piggles mascot registry.
// Copy this file and /assets/webp into your app, or adjust BASE_URL.

export const PIGGLES_BASE_URL = "/characters/piggles";

export const pigglesCharacters = {
  "neutral": { src: `${PIGGLES_BASE_URL}/piggles-neutral.webp`, alt: "Piggles standing and smiling.", category: "core" },
  "wave": { src: `${PIGGLES_BASE_URL}/piggles-wave.webp`, alt: "Piggles smiling and waving.", category: "core" },
  "laptop": { src: `${PIGGLES_BASE_URL}/piggles-laptop.webp`, alt: "Piggles sitting with a laptop and working.", category: "work" },
  "desk": { src: `${PIGGLES_BASE_URL}/piggles-desk-scene.webp`, alt: "Piggles working at a laptop at a desk with a plant and coffee mug.", category: "scene" },
  "thinking": { src: `${PIGGLES_BASE_URL}/piggles-thinking.webp`, alt: "Piggles thinking with one hoof under the chin.", category: "state" },
  "celebrate": { src: `${PIGGLES_BASE_URL}/piggles-celebrate.webp`, alt: "Piggles jumping in celebration.", category: "state" },
  "point-left": { src: `${PIGGLES_BASE_URL}/piggles-point-left.webp`, alt: "Piggles smiling and pointing to the left.", category: "directional" },
  "invoice": { src: `${PIGGLES_BASE_URL}/piggles-invoice.webp`, alt: "Piggles holding and pointing to an invoice.", category: "business" },
  "calendar": { src: `${PIGGLES_BASE_URL}/piggles-calendar.webp`, alt: "Piggles presenting a calendar.", category: "business" },
};

export function getPigglesCharacter(id = "neutral") {
  return pigglesCharacters[id] ?? pigglesCharacters.neutral;
}

export function getPigglesByIntent(intent) {
  const map = {
    welcome: "wave",
    login: "laptop",
    workspace: "laptop",
    help: "thinking",
    question: "thinking",
    success: "celebrate",
    milestone: "celebrate",
    invoice: "invoice",
    money: "invoice",
    bookings: "calendar",
    schedule: "calendar",
    cta: "point-left",
    default: "neutral",
  };
  return getPigglesCharacter(map[intent] ?? "neutral");
}
