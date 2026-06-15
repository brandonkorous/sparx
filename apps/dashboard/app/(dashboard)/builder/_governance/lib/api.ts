// Server-only readers for the Builder governance surface (docs/61 §8 Phase 6b).
// Thin wrappers over the api-rest client. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { AllowlistDto } from './types';

// The tenant's utility-allowlist governance — the immutable platform base rules
// (for display) + the tenant's own additions. Defensive: a failed read degrades
// to empty so the surface still renders.
export async function getAllowlist(): Promise<AllowlistDto> {
  try {
    return await api.get<AllowlistDto>('/v1/builder/governance/allowlist');
  } catch {
    return { base: [], tenant: [] };
  }
}

// Author classes currently DROPPED by the allowlist across this site's drafts — a
// read-time advisory (a blocked class silently no-ops, so the author has no other
// signal it didn't render). Defensive empty on failure.
export async function getBlockedClasses(): Promise<string[]> {
  try {
    const { blocked } = await api.get<{ blocked: string[] }>('/v1/builder/surface/blocked');
    return Array.isArray(blocked) ? blocked : [];
  } catch {
    return [];
  }
}
