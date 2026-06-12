'use server';

// Print-template Server Actions (docs/87 §10) — adapters over api-rest
// /v1/invoicing/templates. The templates surface manages the document's printed
// presentation; publishing a default template switches `…/pdf` from the built-in
// code renderer to the builder-authored tree.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

interface TemplateRef {
  id: string;
  name: string;
}

const templatesPath = '/invoicing/templates';

export async function createTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const tpl = await api.post<TemplateRef>('/v1/invoicing/templates', input);
    revalidatePath(templatesPath);
    return { id: tpl.id };
  });
}

export async function publishTemplateAction(id: string): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const tpl = await api.post<TemplateRef>(`/v1/invoicing/templates/${id}/publish`);
    revalidatePath(templatesPath);
    return { id: tpl.id };
  });
}

export async function setDefaultTemplateAction(id: string): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const tpl = await api.post<TemplateRef>(`/v1/invoicing/templates/${id}/default`);
    revalidatePath(templatesPath);
    return { id: tpl.id };
  });
}

export async function removeTemplateAction(id: string): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/invoicing/templates/${id}`);
    revalidatePath(templatesPath);
  });
}
