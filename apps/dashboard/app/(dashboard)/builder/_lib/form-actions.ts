'use server';

// A silica form's routing settings (docs/115). The form-settings inspector panel
// reads + writes through here; both hops are authenticated + RLS-scoped by api-rest.
//
// Deliberately NOT part of the builder's whole-site autosave. The site sync persists
// the TREE, and a form's recipients are not in the tree — they live in their own
// server-only row precisely so they can never be served to a visitor. So this saves on
// its own, with its own button, and the two never race.

import 'server-only';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { SilicaFormConfig } from '@sparx/builder-schemas';

import type { ActionResult } from './actions';

export interface FormDefinitionDto {
  formNodeId: string;
  pageSlug: string | null;
  recipients: string[];
  config: SilicaFormConfig;
}

export async function getFormDefinition(
  formNodeId: string
): Promise<ActionResult<FormDefinitionDto>> {
  try {
    const data = await api.get<FormDefinitionDto>(
      `/v1/forms/definitions/${encodeURIComponent(formNodeId)}`
    );
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Couldn’t load this form’s settings.' };
  }
}

export async function saveFormDefinition(
  formNodeId: string,
  input: { pageSlug: string | null; recipients: string[]; config: SilicaFormConfig }
): Promise<ActionResult<FormDefinitionDto>> {
  try {
    const data = await api.put<FormDefinitionDto>(
      `/v1/forms/definitions/${encodeURIComponent(formNodeId)}`,
      input
    );
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    // The commonest failure by far is a typo'd address (the route parses recipients as
    // real emails), so surface the server's message rather than a generic one.
    return { ok: false, error: e.message ?? 'Couldn’t save these settings.' };
  }
}
