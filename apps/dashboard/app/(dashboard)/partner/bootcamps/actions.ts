'use server';

import { revalidatePath } from 'next/cache';
import {
  BootcampStatusInput,
  CreateBootcampInput,
  UpdateBootcampInput,
} from '@sparx/partner-schemas';
import { api, type ApiRestError } from '@/lib/api-rest-client';

import type { Bootcamp } from '../_lib/types';

// Bootcamp CRUD server actions (docs/114 §B.5). Validated here with the shared
// schemas; the role gate (editor) + the certified-only publish gate live in the
// api-rest service. Errors bubble up as friendly messages the form surfaces —
// including "Publishing bootcamps requires the Certified partner tier."

export interface FieldError {
  field: string;
  message: string;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldError[];
}

export interface CreateBootcampResult extends MutationResult {
  bootcamp?: Bootcamp;
}

function toFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]): FieldError[] {
  return issues.map((i) => ({ field: String(i.path[0] ?? ''), message: i.message }));
}

export async function createBootcampAction(input: unknown): Promise<CreateBootcampResult> {
  const parsed = CreateBootcampInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  try {
    const bootcamp = await api.post<Bootcamp>('/v1/partner/bootcamps', parsed.data);
    revalidatePath('/partner/bootcamps');
    return { ok: true, bootcamp };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not create the bootcamp.' };
  }
}

export async function updateBootcampAction(id: string, input: unknown): Promise<MutationResult> {
  const parsed = UpdateBootcampInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  try {
    await api.put(`/v1/partner/bootcamps/${id}`, parsed.data);
    revalidatePath('/partner/bootcamps');
    revalidatePath(`/partner/bootcamps/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not save the bootcamp.' };
  }
}

export async function setBootcampStatusAction(id: string, status: string): Promise<MutationResult> {
  const parsed = BootcampStatusInput.safeParse({ status });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid status.' };
  }
  try {
    await api.patch(`/v1/partner/bootcamps/${id}/status`, parsed.data);
    revalidatePath('/partner/bootcamps');
    revalidatePath(`/partner/bootcamps/${id}`);
    return { ok: true };
  } catch (err) {
    // Surfaces the certified-tier publish gate + any state error verbatim.
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not update status.' };
  }
}

export async function deleteBootcampAction(id: string): Promise<MutationResult> {
  try {
    await api.delete(`/v1/partner/bootcamps/${id}`);
    revalidatePath('/partner/bootcamps');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not delete the bootcamp.' };
  }
}
