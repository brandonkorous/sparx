// Minimal class joiner — the brand package stays dependency-free (no clsx / no
// @sparx/ui import), so the marketing bundles can pull these leaf components
// without dragging in the component-library graph.
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
