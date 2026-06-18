'use server';

import { api } from '@/lib/api-rest-client';

// Server actions for the external-sync connection surface (docs/100 P5 Tier C):
// resolve the unmapped-SKU review queue (map → mint a link / ignore) and manage a
// source's SKU mappings (links) directly. Each returns `{ error? }` so the client
// panels can surface the friendly message; the caller refreshes on success.

// UoM conversion + oversell safety buffer a mapping can carry (P5b). Optional —
// defaults are 1:1 UoM and no buffer.
interface MappingControls {
  externalUom?: string | null;
  unitsPerExternal?: number;
  safetyBuffer?: number;
}

interface MapBody extends MappingControls {
  variantId: string;
  warehouseId: string;
}

export async function mapUnmappedSkuAction(
  sourceId: string,
  unmappedId: string,
  body: MapBody
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/inventory/sources/${sourceId}/unmapped/${unmappedId}/map`, body);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Map failed' };
  }
}

export async function ignoreUnmappedSkuAction(
  sourceId: string,
  unmappedId: string
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/inventory/sources/${sourceId}/unmapped/${unmappedId}/ignore`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Ignore failed' };
  }
}

interface CreateLinkBody extends MappingControls {
  variantId: string;
  warehouseId: string;
  externalSku: string;
  externalLocation: string | null;
}

export async function createSourceLinkAction(
  sourceId: string,
  body: CreateLinkBody
): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/inventory/sources/${sourceId}/links`, body);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Add mapping failed' };
  }
}

export async function removeSourceLinkAction(
  sourceId: string,
  linkId: string
): Promise<{ error?: string }> {
  try {
    await api.delete(`/v1/inventory/sources/${sourceId}/links/${linkId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Remove mapping failed' };
  }
}
