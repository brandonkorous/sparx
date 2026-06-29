'use server';

// Tool-policy actions — back the AI → MCP tools surface. They talk to the
// /v1/ai/tool-policies seam (AI-module-gated server-side; the /ai layout gate
// already ensures the module is on). The page reads the catalog via `api.get`;
// these set or clear a per-tool exposure override and reset every override at
// once. Disabling a tool is a SECURITY control — it hides the tool from every
// connected MCP assistant, not just one. Results are the discriminated `{ ok }`
// union so the client can surface the friendly api-rest message.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { ToolPolicyDto } from './_components/tool-types';

export type ToolActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function fail(err: unknown): { ok: false; error: { code: string; message: string } } {
  const e = err as ApiRestError;
  return {
    ok: false,
    error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
  };
}

// Set an explicit exposure override for one tool. `enabled:true` re-exposes a
// disabled tool; `enabled:false` hides it from every MCP connection. Returns the
// tool's updated effective policy.
export async function setToolPolicyAction(
  tool: string,
  enabled: boolean
): Promise<ToolActionResult<ToolPolicyDto>> {
  try {
    const data = await api.put<ToolPolicyDto>(`/v1/ai/tool-policies/${encodeURIComponent(tool)}`, {
      enabled,
    });
    revalidatePath('/ai/tools');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

// Clear a tool's explicit override, returning it to its default-on exposure.
export async function resetToolPolicyAction(
  tool: string
): Promise<ToolActionResult<{ reset: true }>> {
  try {
    const data = await api.delete<{ reset: true }>(
      `/v1/ai/tool-policies/${encodeURIComponent(tool)}`
    );
    revalidatePath('/ai/tools');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

// Clear every override at once — the whole catalog returns to default-on.
export async function resetAllToolPoliciesAction(): Promise<ToolActionResult<{ cleared: number }>> {
  try {
    const data = await api.post<{ cleared: number }>('/v1/ai/tool-policies/reset', {});
    revalidatePath('/ai/tools');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}
