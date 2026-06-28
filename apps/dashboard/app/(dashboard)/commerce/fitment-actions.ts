'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

// Generalized fitment — a domain declares an ordered list of DIMENSIONS (each a
// `level` tier or a `range` axis); a single self-referential node tree holds the
// values at any depth; a product fitment names the deepest level node it targets
// (null = the whole domain) plus a numeric window per range axis.
//
// Every domain is tenant-scoped — there is no global default. The platform ships
// a LIBRARY of installable dictionaries; a tenant installs the ones its catalog
// needs (a vehicle shop installs Vehicle, a phone-case shop installs Device) as
// their own tenant-scoped tree.

export interface FitmentDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
  unit?: string;
}

export interface FitmentDomainRow {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconKey: string | null;
  dimensions: FitmentDimension[];
  position: number;
  rootCount: number;
}

export interface FitmentNodeRow {
  id: string;
  domainId: string;
  parentId: string | null;
  dimensionKey: string;
  name: string;
  slug: string;
  attributes: Record<string, unknown>;
  depth: number;
  position: number;
  childCount: number;
}

// One installable dictionary, picker-summary shape (no tree).
export interface FitmentDictionarySummary {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  dimensions: FitmentDimension[];
  rootCount: number;
  sampleRoots: string[];
}

export interface ProductFitmentRangeRow {
  dimensionKey: string;
  min: number | null;
  max: number | null;
}

export interface ProductFitmentRow {
  id: string;
  domainId: string;
  domainSlug: string;
  nodeId: string | null;
  nodeName: string | null;
  nodePath: string[];
  ranges: ProductFitmentRangeRow[];
  notes: string | null;
}

// ─── Reads ────────────────────────────────────────────────────────────

// The product wizard's Fitment step re-reads existing rows so its replace-all
// save (PUT /fitment) doesn't wipe entries added in a prior visit.
export async function listProductFitmentAction(
  productId: string
): Promise<ActionResult<ProductFitmentRow[]>> {
  return restAction(async () =>
    api.get<ProductFitmentRow[]>(`/v1/commerce/products/${productId}/fitment`)
  );
}

export async function listFitmentDomainsAction(): Promise<ActionResult<FitmentDomainRow[]>> {
  return restAction(async () => api.get<FitmentDomainRow[]>('/v1/commerce/fitment/domains'));
}

/** Children of `parentId` (or the domain's top-level nodes when parentId is null). */
export async function listFitmentNodesAction(
  domainId: string,
  parentId: string | null
): Promise<ActionResult<FitmentNodeRow[]>> {
  const qs = parentId ? `?parentId=${parentId}` : '';
  return restAction(async () =>
    api.get<FitmentNodeRow[]>(`/v1/commerce/fitment/domains/${domainId}/nodes${qs}`)
  );
}

export async function listFitmentDictionariesAction(): Promise<
  ActionResult<FitmentDictionarySummary[]>
> {
  return restAction(async () =>
    api.get<FitmentDictionarySummary[]>('/v1/commerce/fitment/dictionaries')
  );
}

// ─── Domain writes ────────────────────────────────────────────────────

export async function installFitmentDictionaryAction(
  slug: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>(
      `/v1/commerce/fitment/dictionaries/${slug}/install`,
      {}
    );
    revalidatePath('/commerce/fitment');
    return result;
  });
}

export async function createFitmentDomainAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/commerce/fitment/domains', input);
    revalidatePath('/commerce/fitment');
    return result;
  });
}

export async function updateFitmentDomainAction(
  domainId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string }>(
      `/v1/commerce/fitment/domains/${domainId}`,
      input
    );
    revalidatePath('/commerce/fitment');
    return result;
  });
}

/** Uninstall a domain — drops it, its node tree, and every product fitment that
 *  referenced it. Returns the count of affected products. */
export async function deleteFitmentDomainAction(
  domainId: string
): Promise<ActionResult<{ productsAffected: number }>> {
  return restAction(async () => {
    const result = await api.delete<{ productsAffected: number }>(
      `/v1/commerce/fitment/domains/${domainId}`
    );
    revalidatePath('/commerce/fitment');
    return result;
  });
}

// ─── Node writes ──────────────────────────────────────────────────────

export async function createFitmentNodeAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/commerce/fitment/nodes', input);
    revalidatePath('/commerce/fitment');
    return result;
  });
}

export async function updateFitmentNodeAction(
  nodeId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.patch<{ id: string }>(`/v1/commerce/fitment/nodes/${nodeId}`, input);
    revalidatePath('/commerce/fitment');
    return result;
  });
}

/** Delete a node + its subtree. Returns the count of affected products. */
export async function deleteFitmentNodeAction(
  nodeId: string
): Promise<ActionResult<{ productsAffected: number }>> {
  return restAction(async () => {
    const result = await api.delete<{ productsAffected: number }>(
      `/v1/commerce/fitment/nodes/${nodeId}`
    );
    revalidatePath('/commerce/fitment');
    return result;
  });
}

export async function reorderFitmentNodesAction(
  input: unknown
): Promise<ActionResult<{ reordered: boolean }>> {
  return restAction(async () => {
    const result = await api.post<{ reordered: boolean }>(
      '/v1/commerce/fitment/nodes/reorder',
      input
    );
    revalidatePath('/commerce/fitment');
    return result;
  });
}

// ─── Per-product fitment ──────────────────────────────────────────────

export async function setProductFitmentAction(
  productId: string,
  fitments: unknown[]
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.put<{ productId: string; updated: boolean }>(
      `/v1/commerce/products/${productId}/fitment`,
      { fitments }
    );
    revalidatePath(`/commerce/products/${productId}`);
    return { ok: true as const };
  });
}

export async function bulkAssignFitmentAction(
  input: unknown
): Promise<ActionResult<{ rowsAffected: number }>> {
  return restAction(async () => {
    const result = await api.post<{ rowsAffected: number }>(
      '/v1/commerce/fitment/bulk-assign',
      input
    );
    revalidatePath('/commerce/products');
    return result;
  });
}

export async function deleteFitmentAction(
  productId: string,
  fitmentId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/commerce/fitment/${fitmentId}`);
    revalidatePath(`/commerce/products/${productId}`);
    return { id: fitmentId };
  });
}
