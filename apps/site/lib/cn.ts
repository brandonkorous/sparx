// Tiny class-name joiner for the storefront's hand-coded pages.
//
// The storefront's own class joiner (docs/118 Stage 9). Deliberately NOT
// clsx + tailwind-merge: these call sites join a handful of literal class
// strings, never machine-generated utility lists that need conflict resolution,
// so a dependency-free join of the truthy parts is the whole job.

export type ClassValue = string | false | null | undefined;

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
