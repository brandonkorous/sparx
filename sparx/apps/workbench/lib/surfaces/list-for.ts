// The list a detail screen belongs to (persona issue 267).

import { listSurfaces } from './registry';

/**
 * The listed screen whose create button opens `detailKey`, or null.
 *
 * Read from the registry rather than declared again: a list already names its
 * detail screen as `createSurface`, so this is that link read backwards. A gone
 * record's way out is this list.
 */
export function listFor(detailKey: string): string | null {
  const listed = listSurfaces().filter((surface) => surface.listed !== false);
  const byCreate = listed.find((surface) => surface.createSurface === detailKey);
  if (byCreate) return byCreate.key;
  // No create button names it (orders, sites): the list by its plural name.
  const base = detailKey.replace(/\.detail$/, '');
  const names = [`${detailKey}s`, `${base}.list`, `${base}s.list`, base, `${base}s`];
  return (
    names.map((name) => listed.find((surface) => surface.key === name)).find(Boolean)?.key ?? null
  );
}
