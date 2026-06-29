'use server';

// Prompt-template actions — back the AI → Prompt library surface. They talk to
// the /v1/ai/prompt-templates seam (AI-module-gated server-side; the /ai layout
// gate already ensures the module is on). The page reads the list via `api.get`;
// these create / update / delete a template and install the platform default
// library. Every result is the discriminated `{ ok }` union so the client form
// can surface the friendly api-rest message (incl. the 409 on a duplicate key).

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { PromptCategory, PromptTemplateDto, PromptVariable } from './_components/prompt-types';

export type PromptActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function fail(err: unknown): { ok: false; error: { code: string; message: string } } {
  const e = err as ApiRestError;
  return {
    ok: false,
    error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
  };
}

export interface CreatePromptInput {
  key: string;
  name: string;
  description?: string;
  category: PromptCategory;
  body: string;
  variables?: PromptVariable[];
  model?: string;
  enabled?: boolean;
}

// A partial edit — any field except the immutable key. Undefined fields are
// dropped before the PATCH so an edit only touches what changed.
export interface UpdatePromptInput {
  name?: string;
  description?: string | null;
  category?: PromptCategory;
  body?: string;
  variables?: PromptVariable[];
  model?: string | null;
  enabled?: boolean;
}

export async function createPromptAction(
  input: CreatePromptInput
): Promise<PromptActionResult<PromptTemplateDto>> {
  try {
    const data = await api.post<PromptTemplateDto>('/v1/ai/prompt-templates', input);
    revalidatePath('/ai/prompts');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function updatePromptAction(
  id: string,
  input: UpdatePromptInput
): Promise<PromptActionResult<PromptTemplateDto>> {
  try {
    const data = await api.patch<PromptTemplateDto>(`/v1/ai/prompt-templates/${id}`, input);
    revalidatePath('/ai/prompts');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function deletePromptAction(
  id: string
): Promise<PromptActionResult<{ deleted: true }>> {
  try {
    const data = await api.delete<{ deleted: true }>(`/v1/ai/prompt-templates/${id}`);
    revalidatePath('/ai/prompts');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function installDefaultPromptsAction(): Promise<
  PromptActionResult<{ added: number }>
> {
  try {
    const data = await api.post<{ added: number }>('/v1/ai/prompt-templates/install-defaults', {});
    revalidatePath('/ai/prompts');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}
