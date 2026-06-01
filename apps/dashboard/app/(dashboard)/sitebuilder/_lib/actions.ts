'use server';

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { resolveMediaUrl } from './api';
import type { PresentationOverlayV2 } from '@sparx/storefront-themes';
import type { SectionField, TemplateNode } from '@sparx/sitebuilder-schemas';
import type {
  AppearancePolicy,
  BrandDto,
  CustomDefinitionDto,
  PageLayoutDto,
  SavedThemeBrandDto,
  SiteConfigDto,
  SiteLayoutBlockDto,
  SitePublishScheduleDto,
  SiteSectionDto,
  SiteSettingsDto,
  SiteThemeDto,
  SiteVersionDto,
} from './types';

// The create/update payload for a custom section definition (docs/38 Phase C),
// validated server-side by SectionDefinitionInput. `slug` is the immutable type
// identity (create only).
export interface DefinitionInput {
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  binding?: 'product' | 'collection' | null;
  fieldSpec: SectionField[];
  template: TemplateNode;
}

// Thin server-action adapters over api-rest. Server actions inherit the
// session + JWT secret (held only on the dashboard server) and integrate with
// revalidatePath, so the customizer never talks to api-rest from the browser.

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/sitebuilder', 'layout');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

export async function selectTheme(themeKey: string): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.put<SiteConfigDto>('/v1/sitebuilder/config/theme', { themeKey }));
}

export async function updateSettings(input: {
  settings?: SiteSettingsDto;
  appearancePolicy?: AppearancePolicy;
}): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.patch<SiteConfigDto>('/v1/sitebuilder/config/settings', input));
}

// ── Saved themes (docs/33 saved-themes contract) ───────────────────────────
// The merchant's named themes (/v1/sitebuilder/saved-themes). A theme captures
// its base preset, a presentation overlay, AND a brand "look" snapshot
// (colours/fonts/shape), so it's self-contained. `apply` loads the base preset +
// presentation into the draft; the dashboard separately writes the brand via
// /v1/brand (the brand stays tenant-owned — see theme-center onApplySaved).
export async function saveTheme(input: {
  name: string;
  basePresetKey: string;
  presentation: PresentationOverlayV2;
  brand?: SavedThemeBrandDto;
}): Promise<ActionResult<SiteThemeDto>> {
  return run(() => api.post<SiteThemeDto>('/v1/sitebuilder/saved-themes', input));
}

export async function renameTheme(id: string, name: string): Promise<ActionResult<SiteThemeDto>> {
  return run(() => api.patch<SiteThemeDto>(`/v1/sitebuilder/saved-themes/${id}`, { name }));
}

// Edit a saved theme in place — name, presentation overlay, and/or brand "look".
// Used when a saved theme is the selected/active theme: presentation AND brand
// edits write back into it so "select and tweak" actually modifies the snapshot.
// (The base preset is fixed at creation; the backend update accepts the rest.)
export async function updateSavedTheme(
  id: string,
  input: { name?: string; presentation?: PresentationOverlayV2; brand?: SavedThemeBrandDto }
): Promise<ActionResult<SiteThemeDto>> {
  return run(() => api.patch<SiteThemeDto>(`/v1/sitebuilder/saved-themes/${id}`, input));
}

export async function deleteSavedTheme(id: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/sitebuilder/saved-themes/${id}`));
}

export async function applySavedTheme(id: string): Promise<ActionResult<SiteConfigDto>> {
  return run(() => api.post<SiteConfigDto>(`/v1/sitebuilder/saved-themes/${id}/apply`, {}));
}

// ── Custom section definitions (docs/38 Phase C — the Section Studio) ───────
// Author a custom section TYPE. Bodies are validated server-side
// (SectionDefinitionInput + validateTemplate); the slug addresses the type.
export async function createDefinition(
  input: DefinitionInput
): Promise<ActionResult<CustomDefinitionDto>> {
  return run(() => api.post<CustomDefinitionDto>('/v1/sitebuilder/definitions', input));
}

export async function updateDefinition(
  slug: string,
  input: Omit<DefinitionInput, 'slug'>
): Promise<ActionResult<CustomDefinitionDto>> {
  return run(() =>
    api.put<CustomDefinitionDto>(`/v1/sitebuilder/definitions/${encodeURIComponent(slug)}`, input)
  );
}

export async function deleteDefinition(slug: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/sitebuilder/definitions/${encodeURIComponent(slug)}`));
}

export async function createSection(input: {
  pageLayoutId: string;
  sectionType: string;
  config?: Record<string, unknown>;
  position?: number;
}): Promise<ActionResult<SiteSectionDto>> {
  return run(() => api.post<SiteSectionDto>('/v1/sitebuilder/sections', input));
}

// "Customize this layout" (docs/36 §3): resolve-or-create the target's page layout
// and, if still empty, copy the code-defined default into real section rows.
// Idempotent — a customized layout is returned untouched.
export async function materializeLayout(input: {
  targetId: string;
  key?: string;
}): Promise<ActionResult<{ pageLayout: PageLayoutDto; sections: SiteSectionDto[] }>> {
  return run(() =>
    api.post<{ pageLayout: PageLayoutDto; sections: SiteSectionDto[] }>(
      '/v1/sitebuilder/page-layouts/materialize',
      input
    )
  );
}

// Instantiate a NEW named layout for a target from a Page Template (docs/36 §10).
// Used by the Layouts surface "New layout" flow — creates an editable layout
// (with the template's sections) the merchant then opens in the canvas editor.
export async function instantiateLayout(input: {
  targetId: string;
  templateId: string;
  name?: string;
  key?: string;
}): Promise<ActionResult<{ pageLayout: PageLayoutDto; sections: SiteSectionDto[] }>> {
  return run(() =>
    api.post<{ pageLayout: PageLayoutDto; sections: SiteSectionDto[] }>(
      '/v1/sitebuilder/page-layouts/instantiate',
      input
    )
  );
}

export async function renamePageLayout(
  id: string,
  name: string
): Promise<ActionResult<PageLayoutDto>> {
  return run(() => api.patch<PageLayoutDto>(`/v1/sitebuilder/page-layouts/${id}`, { name }));
}

export async function deletePageLayout(id: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/sitebuilder/page-layouts/${id}`));
}

// Set / clear the per-target tenant default layout (docs/36 §6). The Layouts
// surface owns these (the per-item override is set from the item editor, P-C).
export async function setLayoutDefault(
  targetId: string,
  pageLayoutId: string
): Promise<ActionResult<unknown>> {
  return run(() =>
    api.post<unknown>('/v1/sitebuilder/assignments/default', { targetId, pageLayoutId })
  );
}

export async function clearLayoutDefault(targetId: string): Promise<ActionResult<unknown>> {
  const qs = `target_id=${encodeURIComponent(targetId)}`;
  return run(() => api.delete<unknown>(`/v1/sitebuilder/assignments/default?${qs}`));
}

// Layout assignment (docs/36 §6, P-C). Invoked from the Commerce/CMS item
// editors (cross-module — the assignment tables are Site-Builder-owned, written
// via the SB API). No `/sitebuilder` revalidation: the picker `router.refresh()`s
// its own route after the call.
async function restAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

export async function assignLayout(
  targetId: string,
  itemRef: string,
  pageLayoutId: string
): Promise<ActionResult<unknown>> {
  return restAction(() =>
    api.post<unknown>('/v1/sitebuilder/assignments', { targetId, itemRef, pageLayoutId })
  );
}

export async function unassignLayout(
  targetId: string,
  itemRef: string
): Promise<ActionResult<unknown>> {
  const qs = `target_id=${encodeURIComponent(targetId)}&item_ref=${encodeURIComponent(itemRef)}`;
  return restAction(() => api.delete<unknown>(`/v1/sitebuilder/assignments?${qs}`));
}

export async function updateSection(
  id: string,
  input: { config?: Record<string, unknown>; visible?: boolean }
): Promise<ActionResult<SiteSectionDto>> {
  return run(() => api.patch<SiteSectionDto>(`/v1/sitebuilder/sections/${id}`, input));
}

export async function reorderSections(
  pageLayoutId: string,
  orderedIds: string[]
): Promise<ActionResult<{ sections: SiteSectionDto[] }>> {
  return run(() =>
    api.post<{ sections: SiteSectionDto[] }>('/v1/sitebuilder/sections/reorder', {
      pageLayoutId,
      orderedIds,
    })
  );
}

export async function removeSection(id: string): Promise<ActionResult> {
  return run(() => api.delete<void>(`/v1/sitebuilder/sections/${id}`));
}

export async function upsertLayout(
  slot: 'header' | 'footer' | 'announcement',
  input: { navigationMenuId?: string | null; config?: Record<string, unknown>; visible?: boolean }
): Promise<ActionResult<SiteLayoutBlockDto>> {
  return run(() => api.put<SiteLayoutBlockDto>(`/v1/sitebuilder/layout/${slot}`, input));
}

// Brand is tenant-level (docs/30 §6) — PATCH merges the provided fields into
// the single tenant_brands row. All fields optional; a present null clears.
export type BrandPatch = Partial<Omit<BrandDto, 'tenantId'>>;

export async function updateBrand(input: BrandPatch): Promise<ActionResult<BrandDto>> {
  return run(() => api.patch<BrandDto>('/v1/brand', input));
}

// Resolve a freshly-picked/uploaded asset id to a preview URL for the brand
// board, without touching revalidation (pure read).
export async function resolveBrandMedia(mediaId: string | null): Promise<string | null> {
  return resolveMediaUrl(mediaId);
}

export async function publishNow(note?: string): Promise<ActionResult<SiteVersionDto>> {
  return run(() => api.post<SiteVersionDto>('/v1/sitebuilder/publish', { note }));
}

export async function rollback(versionId: string): Promise<ActionResult<SiteVersionDto>> {
  return run(() => api.post<SiteVersionDto>('/v1/sitebuilder/rollback', { versionId }));
}

export async function schedulePublish(
  scheduledAt: string,
  note?: string
): Promise<ActionResult<SitePublishScheduleDto>> {
  return run(() =>
    api.post<SitePublishScheduleDto>('/v1/sitebuilder/schedule', { scheduledAt, note })
  );
}

export async function cancelSchedule(id: string): Promise<ActionResult<SitePublishScheduleDto>> {
  return run(() => api.delete<SitePublishScheduleDto>(`/v1/sitebuilder/schedules/${id}`));
}
