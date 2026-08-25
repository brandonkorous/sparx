'use client';

// The first half of setup: what the business does, which design it starts from,
// and what it is called.
//
// Module-level functions rather than closures so they can live in their own file;
// each takes the cache-invalidation callback the hook in api.ts supplies.

import { api } from '../api/client';
import type { OnboardingPatch, OnboardingState, SlugAvailability } from './types';

export type Done = () => void;

export async function patchOnboarding(patch: OnboardingPatch): Promise<OnboardingState> {
  return api.patch<OnboardingState>('/v1/tenant/onboarding', patch);
}

// ── Step 1 — Modules ─────────────────────────────────────────────────────────
export async function saveModules(modules: Record<string, boolean>, done: Done): Promise<void> {
  await api.put('/v1/tenant/modules', { modules });
  await patchOnboarding({ completed: { modules: true }, currentStep: 'template' });
  done();
}

// ── Step 2 — Template ────────────────────────────────────────────────────────

/** Whether the chosen design's EXAMPLES come with it (issue 098). Sent on every
 *  install: the server records the answer and reads it again months later, when a
 *  feature is switched on, so it can never quietly hand back what was declined. */
export interface TemplateChoice {
  key: string;
  sampleData: boolean;
}

/** Reselecting the same template keeps the existing install (idempotent);
 *  switching resets the old draft first so no orphan install is stranded.
 *  Changing only the examples answer is a switch too — the answer is fixed at
 *  install time, so the old draft has to go for the new one to mean anything. */
export async function selectTemplate(
  choice: TemplateChoice,
  done: Done
): Promise<{ installId: string }> {
  const state = await api.get<{
    blueprintKey: string | null;
    installId: string | null;
    sampleData?: boolean;
  }>('/v1/tenant/onboarding');
  const sameDesign = state.blueprintKey === choice.key && state.installId !== null;
  const sameAnswer = (state.sampleData ?? true) === choice.sampleData;

  let installId: string;
  if (sameDesign && sameAnswer && state.installId) {
    installId = state.installId;
  } else {
    if (state.installId) {
      await api
        .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
        .catch(() => undefined);
    }
    const res = await api.post<{ install_id: string }>(
      `/v1/blueprints/${encodeURIComponent(choice.key)}/install`,
      { sample_data: choice.sampleData }
    );
    installId = res.install_id;
  }
  await patchOnboarding({
    blueprintKey: choice.key,
    installId,
    sampleData: choice.sampleData,
    completed: { template: true },
    currentStep: 'workspace',
  });
  done();
  return { installId };
}

/** Start from scratch: no blueprint. Clears any prior selection and advances — it
 *  does NOT touch the Builder flag (whatever the Modules step saved stands). */
export async function startFromScratch(done: Done): Promise<void> {
  const state = await api.get<{ installId: string | null }>('/v1/tenant/onboarding');
  if (state.installId) {
    await api
      .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
      .catch(() => undefined);
  }
  await patchOnboarding({
    blueprintKey: null,
    installId: null,
    completed: { template: true },
    currentStep: 'workspace',
  });
  done();
}

// ── Step 3 — Workspace ───────────────────────────────────────────────────────
export async function checkSlug(slug: string): Promise<SlugAvailability> {
  return api.get<SlugAvailability>(`/v1/tenant/slug-availability?slug=${encodeURIComponent(slug)}`);
}

export interface WorkspaceInput {
  companyName: string;
  slug: string;
  siteName: string;
}

export async function saveWorkspace(input: WorkspaceInput, done: Done): Promise<void> {
  // Slug first — it's the most likely to fail (taken/reserved), so a bad slug
  // aborts before any other write.
  await api.patch('/v1/tenant/slug', { slug: input.slug });
  await api.patch('/v1/tenant', { name: input.companyName });
  const properties =
    await api.get<{ id: string; name: string; isPrimary: boolean }[]>('/v1/properties');
  const primary = properties.find((p) => p.isPrimary) ?? properties[0];
  if (primary && primary.name !== input.siteName) {
    await api.patch(`/v1/properties/${encodeURIComponent(primary.id)}`, { name: input.siteName });
  }
  await patchOnboarding({ completed: { workspace: true }, currentStep: 'domain' });
  done();
}
