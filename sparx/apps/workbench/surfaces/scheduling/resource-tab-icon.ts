'use client';

// THE TAB's picture for one resource, known without its pane (sparx persona issue
// 086, second pass).
//
// A pane that claims its own tab icon only does so once it has rendered, and a
// tab restored into the dock is not rendered until somebody clicks it. So
// "Bay 2 (light duty)", restored and never opened, still drew a person beside
// "Bay 1", which drew a door. The tab reads the resource itself instead, through
// the SAME query the pane uses: one request shared by both, the cached answer the
// moment either has it, and a change of kind follows on save, because saving
// refreshes that query.

import type { LucideIcon } from 'lucide-react';

import type { SurfaceParams } from '../../lib/surfaces/descriptor';
import { resourceKindIcon } from './resource-kind-icon';
import { useResource } from './setup-data';

/** The picture for the resource a `scheduling.resources.detail` tab shows, or
 *  undefined until it is known (the surface's own icon stands in meanwhile). */
export function useResourceTabIcon(params: SurfaceParams): LucideIcon | undefined {
  const id = typeof params.id === 'string' && params.id !== '' ? params.id : 'new';
  const resource = useResource(id);
  if (id === 'new' || !resource.data) return undefined;
  return resourceKindIcon(resource.data.kind);
}
