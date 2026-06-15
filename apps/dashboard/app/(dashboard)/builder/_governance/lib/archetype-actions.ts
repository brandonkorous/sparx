'use server';

// Server-action adapters over api-rest for the Builder governance Sections tab —
// the brand-section archetype catalog (docs/61 §6 Phase 6b). Server actions
// inherit the session + JWT (held only on the dashboard server) and integrate
// with revalidatePath. Mirrors _governance/lib/actions.ts + component-actions.ts.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { ArchetypeDto, ArchetypeSummaryDto, BuilderNode } from '@sparx/builder-schemas';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/builder/governance', 'layout');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

/** Slug a display name into a valid archetype key (^[a-z][a-z0-9_]*$, ≤64). */
function deriveKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return /^[a-z]/.test(slug) ? slug : `s_${slug}`.slice(0, 64);
}

export async function createArchetype(input: {
  name: string;
  family?: string;
  icon?: string;
  description?: string;
  tree: BuilderNode;
}): Promise<ActionResult<ArchetypeDto>> {
  return run(() =>
    api.post<ArchetypeDto>('/v1/builder/archetypes', {
      key: deriveKey(input.name),
      name: input.name,
      family: input.family ?? 'content',
      icon: input.icon ?? 'box',
      description: input.description ?? null,
      surfaces: ['page', 'site'],
      tree: input.tree,
    })
  );
}

export async function setArchetypeEnabled(
  key: string,
  enabled: boolean
): Promise<ActionResult<ArchetypeSummaryDto>> {
  return run(() =>
    api.patch<ArchetypeSummaryDto>(`/v1/builder/archetypes/${encodeURIComponent(key)}`, { enabled })
  );
}

export async function updateArchetypeIdentity(
  key: string,
  input: { name?: string; family?: string; icon?: string; description?: string | null }
): Promise<ActionResult<ArchetypeSummaryDto>> {
  return run(() =>
    api.patch<ArchetypeSummaryDto>(`/v1/builder/archetypes/${encodeURIComponent(key)}`, input)
  );
}

export async function deleteArchetype(key: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/builder/archetypes/${encodeURIComponent(key)}`));
}
