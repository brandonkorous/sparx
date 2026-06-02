// Tiny class-name joiner. Unlike @sparx/ui's `cn` (clsx + tailwind-merge),
// site-ui authors semantic `sf-*` classes — there are no Tailwind utilities to
// dedupe/merge — so a dependency-free join of truthy parts is all we need.

export type ClassValue = string | false | null | undefined;

export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
