'use server';

// Server actions for tenant component CRUD (docs/53, P-A). Thin adapters over
// api-rest, mirroring the builder page actions. Structural ops revalidate
// /builder/components so the catalog reflects the change on the next navigation.
//
// COPY is the seed UX: it materializes a starting tree (built client-side from a
// system component via makeNode) into a new tenant component, generating a
// unique key server-side so the caller never has to.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type {
  BuilderNode,
  ComponentDto,
  ComponentGroup,
  ComponentSummaryDto,
  ComponentSurface,
  ComponentUsageDto,
  PropSpec,
} from '@sparx/builder-schemas';
import type { ActionResult } from '../../_lib/actions';

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/builder/components', 'layout');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

export interface ComponentInput {
  key: string;
  name: string;
  group: ComponentGroup;
  icon: string;
  description?: string | null;
  surfaces: ComponentSurface[];
  tree: BuilderNode;
  propSpec?: PropSpec[];
}

export async function createComponent(input: ComponentInput): Promise<ActionResult<ComponentDto>> {
  return run(() => api.post<ComponentDto>('/v1/builder/components', input));
}

export async function updateComponent(
  key: string,
  patch: Partial<Omit<ComponentInput, 'key'>>
): Promise<ActionResult<ComponentDto>> {
  return run(() =>
    api.patch<ComponentDto>(`/v1/builder/components/${encodeURIComponent(key)}`, patch)
  );
}

export async function deleteComponent(key: string): Promise<ActionResult<{ key: string }>> {
  return run(() =>
    api.delete<{ key: string }>(`/v1/builder/components/${encodeURIComponent(key)}`)
  );
}

// Where a component is placed (docs/53 §6) — read before deleting so the UI can
// warn instead of letting the server reject. A read, so no revalidate.
export async function getComponentUsages(key: string): Promise<ActionResult<ComponentUsageDto>> {
  try {
    const data = await api.get<ComponentUsageDto>(
      `/v1/builder/components/${encodeURIComponent(key)}/usages`
    );
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

// camelCase/underscore a name into a valid component key (^[a-z][a-z0-9_]*$),
// de-duped against the tenant's existing keys with a numeric suffix.
function deriveKey(name: string, taken: Set<string>): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50) || 'component';
  const key = /^[a-z]/.test(base) ? base : `c_${base}`;
  if (!taken.has(key)) return key;
  let n = 2;
  while (taken.has(`${key}_${n}`)) n += 1;
  return `${key}_${n}`;
}

/** Copy a starting tree into a NEW tenant component (the seed UX — "start from
 *  Button → our brand CTA"). The caller (client) builds `tree` from a system
 *  component via makeNode; this derives a unique key from `name` and creates it. */
export async function copyComponent(seed: {
  name: string;
  group: ComponentGroup;
  icon: string;
  surfaces: ComponentSurface[];
  tree: BuilderNode;
}): Promise<ActionResult<ComponentDto>> {
  return run(async () => {
    const { components } = await api.get<{ components: ComponentSummaryDto[] }>(
      '/v1/builder/components'
    );
    const key = deriveKey(seed.name, new Set(components.map((c) => c.key)));
    return api.post<ComponentDto>('/v1/builder/components', {
      key,
      name: seed.name,
      group: seed.group,
      icon: seed.icon,
      surfaces: seed.surfaces,
      tree: seed.tree,
    });
  });
}
