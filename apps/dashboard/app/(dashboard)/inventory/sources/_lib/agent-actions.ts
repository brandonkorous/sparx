'use server';

import { api } from '@/lib/api-rest-client';

// Tier A bridge agent pairing (docs/100 P5d). `enroll` mints (or rotates) the
// tenant-scoped bridge key and returns the plaintext ONCE — the client shows it in
// a copy-then-dismiss modal and never stores it. `revoke` unpairs + revokes the key.

interface EnrollResponse {
  sourceId: string;
  apiKey: string;
  prefix: string;
  rotated: boolean;
}

export type EnrollResult = { apiKey: string; prefix: string; rotated: boolean } | { error: string };

export async function enrollAgentAction(sourceId: string): Promise<EnrollResult> {
  try {
    const data = await api.post<EnrollResponse>(`/v1/inventory/sources/${sourceId}/enroll`);
    return { apiKey: data.apiKey, prefix: data.prefix, rotated: data.rotated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Pairing failed' };
  }
}

export async function revokeAgentAction(sourceId: string): Promise<{ error?: string }> {
  try {
    await api.post(`/v1/inventory/sources/${sourceId}/revoke-agent`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unpair failed' };
  }
}
