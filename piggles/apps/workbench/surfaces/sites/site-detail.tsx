'use client';

// One site — create it, rename it, choose what it shows, retire it.
//
// Create and manage are the same surface at two ages, so they share one route
// and one registry key; the pane picks between them on the id. They are separate
// files because they share almost nothing beyond that: a site is created with a
// name and a web address, then configured once it exists.

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CreateSite } from './site-create';
import { ManageSite } from './site-manage';

export function SiteDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <CreateSite ctx={ctx} /> : <ManageSite ctx={ctx} id={id} />;
}
