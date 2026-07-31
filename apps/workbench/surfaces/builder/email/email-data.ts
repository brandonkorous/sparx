'use client';

// Email designs data — the emails a tenant sends (order confirmations, welcomes,
// campaigns), and the moves the composer makes on one.
//
// An email is a silica `EmailDocument` (docs/120): a subject, a preheader, and a
// body of email-safe sections. sparx stores that document OPAQUELY — it never
// parses an email node — so this module treats `silicaDoc` as `unknown` and hands
// it straight to the composer, which is the only place that imports the silica
// email types. Keeping the wire type opaque here is what lets the LIST surface and
// this data layer typecheck without pulling the whole builder engine in.
//
// The catalog is SEEDED on first read (`listOrSeed`): a tenant always has the ~13
// provisioned defaults, so this list is never genuinely empty — an empty result
// means a filter matched nothing or the module is off, never "make your first one".

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type { EmailColorDefaults, EmailFrame } from '@wizeworks/silicaui-builder/email';
import type { PresentationOverlayV2, TenantBrandColumns } from '@sparx/site-themes';
import { api } from '../../../lib/api/client';

/** One email design, exactly as `/v1/builder/emails` returns it. `silicaDoc` is the
 *  DRAFT document the composer edits; it is opaque here (the composer types it as a
 *  silica `EmailDocument`). Never null — a row authored on the retired engine is
 *  converted on read, so the editor always opens on real content. */
export interface EmailDesign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  /** Opaque silica `EmailDocument`. Typed properly only inside the composer. */
  silicaDoc: unknown;
  /** Whether a published snapshot exists (this draft may sit ahead of it). */
  published: boolean;
  /** True when this email is published but its draft has since diverged — saved edits
   *  recipients aren't getting until the next Publish. */
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  position: number;
  /** The built-in identity for a provisioned default (`welcome-customer`, …), or
   *  null for a custom email the tenant created. */
  key: string | null;
  /** The campaign an author's link clicks report under (docs/impl transactional-email
   *  Slice 10). Null → clicks report under the email's name; a value overrides it. */
  trackingCampaign: string | null;
  /** `tenant` — shared by every site; `site` — a per-site override/custom. */
  scope: 'tenant' | 'site';
  createdAt: string;
  updatedAt: string;
}

/** A single pre-send check (mirrors `@sparx/email`'s `EmailCheck` — duplicated because
 *  a client component must not import the server email package, the same way
 *  `EMAIL_SEMANTIC_TOKENS` is duplicated). */
export type EmailCheckLevel = 'pass' | 'warning' | 'error';
export interface EmailCheck {
  id: string;
  level: EmailCheckLevel;
  title: string;
  detail: string;
}

/** The rendered, email-safe output of the DRAFT — the branded HTML a recipient
 *  actually receives, its plain-text alternative, the pre-send checklist, and the
 *  dark-theme override rules for the Light/Dark preview toggle (empty when the brand
 *  has no dark palette). */
export interface EmailPreview {
  subject: string;
  html: string;
  text: string;
  checks: EmailCheck[];
  darkCss: string;
}

export const EMAILS_KEY = ['builder', 'emails'];

/** One entry in an email's publish history (mirrors `emailVersionService`'s
 *  `EmailVersionSummary`). `current` marks the version that is published right now. */
export interface EmailVersion {
  id: string;
  subject: string;
  actorId: string | null;
  createdAt: string;
  current: boolean;
}

/** Every email design on the account. `listOrSeed` provisions the defaults on the
 *  first call, so this resolves to a populated list rather than an empty one. */
export function useEmails() {
  return useQuery({
    queryKey: EMAILS_KEY,
    queryFn: () => api.get<{ emails: EmailDesign[] }>('/v1/builder/emails').then((r) => r.emails),
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: ['builder', 'emails', id],
    queryFn: () => api.get<EmailDesign>(`/v1/builder/emails/${id}`),
    enabled: id !== 'new',
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: EMAILS_KEY });
    if (id) void queryClient.invalidateQueries({ queryKey: ['builder', 'emails', id] });
  };
}

/** Create a blank email. The service seeds it from the blank starter, so the
 *  composer opens on a real (empty) document rather than nothing. */
export function useCreateEmail() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<EmailDesign>('/v1/builder/emails', input),
    onSuccess: (email) => {
      invalidate(email.id);
    },
  });
}

export function useRenameEmail(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => api.patch<EmailDesign>(`/v1/builder/emails/${id}`, { name }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Set (or clear) this email's link-tracking campaign override — a settings PATCH,
 *  saved immediately like a rename, separate from the silica-doc Save. `null` clears
 *  it back to the email's name. */
export function useSetEmailCampaign(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (trackingCampaign: string | null) =>
      api.patch<EmailDesign>(`/v1/builder/emails/${id}`, { trackingCampaign }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteEmail(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.delete(`/v1/builder/emails/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Persist the whole silica document (last-write-wins). This is the editor's
 *  explicit Save — there is no autosave, so a burst of edits is one write when the
 *  operator presses Save. */
export function useSaveEmailDoc(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (doc: unknown) => api.put<EmailDesign>(`/v1/builder/emails/${id}/silica`, { doc }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Snapshot the stored draft into the published version. The composer saves the
 *  current draft first, so publishing captures exactly what is on the canvas. */
export function usePublishEmail(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<EmailDesign>(`/v1/builder/emails/${id}/silica/publish`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Render the DRAFT to email-safe HTML in this site's brand. On-demand rather than
 *  a live query: the operator opens the preview after saving, so it reflects the
 *  stored draft. */
export function usePreviewEmail(id: string) {
  return useMutation({
    mutationFn: () => api.get<EmailPreview>(`/v1/builder/emails/${id}/preview`),
  });
}

/** An email's publish history, newest first. Lazy — only fetched when the History
 *  panel is open (`enabled`), since most editing sessions never open it. */
export function useEmailVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['builder', 'emails', id, 'versions'],
    queryFn: () =>
      api
        .get<{ versions: EmailVersion[] }>(`/v1/builder/emails/${id}/versions`)
        .then((r) => r.versions),
    enabled: enabled && id !== '' && id !== 'new',
  });
}

/** Restore a published version into the DRAFT (non-destructive — it loads the version
 *  onto the draft for review, it does NOT republish). The server returns the email with
 *  its restored draft; we push that straight into the caches so the studio reseeds the
 *  canvas from it without waiting for a refetch. */
export function useRestoreEmailVersion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<EmailDesign>(`/v1/builder/emails/${id}/versions/${versionId}/restore`),
    onSuccess: (email) => {
      queryClient.setQueryData<EmailDesign[]>(EMAILS_KEY, (prev) =>
        prev?.map((e) => (e.id === email.id ? email : e))
      );
      queryClient.setQueryData(['builder', 'emails', email.id], email);
      void queryClient.invalidateQueries({ queryKey: ['builder', 'emails', id, 'versions'] });
    },
  });
}

// ── Saved blocks library (docs/impl transactional-email Slice 9) ──────────────
//
// The tenant's account-level, server-backed saved-block library. silica's
// `<EmailBuilder>` defaults to keeping "Save as block" in browser localStorage —
// trapped in one browser, lost on a device change, unshareable. Handing it the
// `savedBlocks` controlled prop + `onSavedBlocksChange` makes THIS the source of
// truth: a block follows the whole team across devices and is shared tenant-wide.
// The node is opaque here (a silica `EmailNode`), same as `silicaDoc` — only the
// composer types it, so this data layer stays free of the email engine.

export const EMAIL_BLOCKS_KEY = ['builder', 'email-blocks'];

/** One saved block as `/v1/builder/email-blocks` returns it. Mirrors silica's
 *  `SavedBlock` ({ id, name, node, savedAt }); `node` is opaque here. */
export interface SavedEmailBlock {
  id: string;
  name: string;
  /** Opaque silica `EmailNode`. Typed properly only inside the composer. */
  node: unknown;
  /** Epoch ms the block was saved — silica orders the palette library by it. */
  savedAt: number;
}

/** The tenant's whole saved-block library, newest first. Always fetched (the
 *  composer needs it mounted so the Insert palette's saved group is populated). */
export function useSavedEmailBlocks() {
  return useQuery({
    queryKey: EMAIL_BLOCKS_KEY,
    queryFn: () =>
      api.get<{ blocks: SavedEmailBlock[] }>('/v1/builder/email-blocks').then((r) => r.blocks),
    staleTime: 300_000,
  });
}

// Each mutation reconciles the cache on SETTLE, not just success: the editor
// optimistically writes silica's `next` list (with a temp id for a save) into the
// cache for instant palette feedback, so refetching after BOTH success and failure
// is what replaces the temp id with the server row — or rolls the optimistic entry
// back if the write failed.

/** Save a block. Returns the SERVER row (with its assigned id) so the optimistic
 *  temp-id entry silica handed the host reconciles on refetch — the crux of
 *  controlled mode over fire-and-forget writes. */
export function useCreateSavedEmailBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; node: unknown }) =>
      api.post<SavedEmailBlock>('/v1/builder/email-blocks', input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EMAIL_BLOCKS_KEY });
    },
  });
}

/** Rename a saved block. */
export function useRenameSavedEmailBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.patch<{ id: string }>(`/v1/builder/email-blocks/${input.id}`, { name: input.name }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EMAIL_BLOCKS_KEY });
    },
  });
}

/** Delete a saved block. */
export function useDeleteSavedEmailBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/builder/email-blocks/${id}`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EMAIL_BLOCKS_KEY });
    },
  });
}

/** Queue a staff smoke test through the real send path (email-worker → Mailgun in
 *  prod), rendered exactly as a real send. */
export function useSendEmailTest(id: string) {
  return useMutation({
    mutationFn: (to: string) =>
      api.post<{ queued: boolean; to: string }>(`/v1/builder/emails/${id}/test-send`, { to }),
  });
}

/** Fork a shared, tenant-wide default into a version that belongs to just this
 *  site (docs/49 Phase 7b). Idempotent server-side — a repeat returns the existing
 *  override — and keyed by the default's built-in `key`. Returns the new per-site
 *  row, which the studio then switches to. */
export function useCustomizeEmailForSite() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { propertyId: string; key: string }) =>
      api.post<EmailDesign>(`/v1/builder/emails/site/${input.propertyId}/customize`, {
        key: input.key,
      }),
    onSuccess: (email) => {
      invalidate(email.id);
    },
  });
}

// ── Brand → canvas theme (docs/49 · docs/120) ────────────────────────────────
//
// The email CANVAS seeds new blocks in the tenant's real brand, so an author edits
// against their own colours and type rather than a neutral preset. This only tints
// the EDIT preview — the Preview dialog and every real send re-resolve the brand
// server-side, so a stale or failed read here never reaches a recipient. That is
// why the compile falls back to a preset (in the editor) rather than blocking.

/** The tenant brand as `/v1/brand` returns it — the colour/type columns the theme
 *  compiler reads (`TenantBrandColumns`) plus the identity fields it ignores. Typed
 *  as the columns because that is exactly the subset the canvas theme consumes. */
export type TenantBrand = TenantBrandColumns;

/** The tenant brand identity. Platform-level (like `/v1/tenant`), so this read works
 *  regardless of the active site; the per-site override is applied on top. */
export function useTenantBrand() {
  return useQuery({
    queryKey: ['brand'],
    queryFn: () => api.get<TenantBrand>('/v1/brand'),
    staleTime: 300_000,
  });
}

/** The Site Builder draft config — its `themeKey` and presentation overlay are the
 *  other two inputs the theme compiler needs (alongside the brand). */
export interface SiteBuilderConfig {
  themeKey: string;
  draftSettings: { presentation?: PresentationOverlayV2 | null } | null;
}

export function useSiteBuilderConfig() {
  return useQuery({
    queryKey: ['sitebuilder', 'config'],
    queryFn: () => api.get<SiteBuilderConfig>('/v1/sitebuilder/config'),
    staleTime: 300_000,
  });
}

/** A site as `/v1/properties` returns it, narrowed to what the per-site brand merge
 *  needs. Shares the `['properties']` cache with the shell's `useSites`, so this
 *  costs no extra request — it just reads the richer fields that list also carries. */
export interface SiteBrandInfo {
  id: string;
  isPrimary: boolean;
  brandOverride: unknown;
}

export function useSiteBrandInfos() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<SiteBrandInfo[]>('/v1/properties'),
    staleTime: 300_000,
  });
}

/** Everything the canvas needs to render the email as it ships, resolved SERVER-SIDE
 *  from the active site's brand: the inert `frame` (brand bar + wordmark + legal
 *  footer, silicaui 0.34) AND the `colors` map the send paints with. The studio feeds
 *  `colors` to the canvas theme so silica repaints every block in the EXACT brand +
 *  semantic colours the inbox gets (not the site page theme, which can diverge), and
 *  passes `frame` to `<EmailBuilder frame>`. Keyed without the site id because a site
 *  switch reloads the whole app (see `switchSite`), refetching this fresh. */
export interface EmailChrome {
  frame: EmailFrame;
  colors: EmailColorDefaults;
}

export function useEmailChrome() {
  return useQuery({
    queryKey: ['builder', 'emails', 'chrome'],
    queryFn: () => api.get<EmailChrome>('/v1/builder/emails/frame'),
    staleTime: 300_000,
  });
}

/**
 * The brand the ACTIVE site actually authors against — the tenant base with THIS
 * site's override laid on top (docs/49). Only the token-bearing fields (colour,
 * type, and the shape/rhythm/effect `tokens` doc) matter to the theme compiler, so
 * only those are merged; logos and taglines don't shift the canvas palette.
 * `null`/absent override fields inherit the base.
 *
 * The primary site is not special-cased. It used to short-circuit to the bare base,
 * which was correct only while the primary's brand WAS the base — the arrangement
 * that leaked one site's identity onto its siblings. Every site now stores its own.
 */
export function effectiveTenantBrand(base: TenantBrand, overrideRaw: unknown): TenantBrand {
  if (!overrideRaw || typeof overrideRaw !== 'object') return base;
  const o = overrideRaw as Record<string, unknown>;
  const pick = (key: keyof TenantBrand): string | null => {
    const value = o[key as string];
    if (typeof value === 'string') return value;
    return (base[key] as string | null | undefined) ?? null;
  };
  return {
    colorPrimary: pick('colorPrimary'),
    colorPrimaryForeground: pick('colorPrimaryForeground'),
    colorSecondary: pick('colorSecondary'),
    colorSecondaryForeground: pick('colorSecondaryForeground'),
    colorAccent: pick('colorAccent'),
    colorAccentForeground: pick('colorAccentForeground'),
    fontHeading: pick('fontHeading'),
    fontBody: pick('fontBody'),
    tokens: o.tokens ?? base.tokens,
  };
}

/**
 * The server's own sentence for a 4xx, shown verbatim — the email routes explain
 * what went wrong (a bad address, a document that failed to render) better than a
 * status code could. A 5xx has no such sentence, so it falls back to the caller's
 * wording.
 */
export function emailErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** How an email is doing, in words + a tone for `<Badge color>`. */
export function emailStatus(email: Pick<EmailDesign, 'published'>): {
  label: string;
  tone: 'success' | 'warning';
} {
  return email.published
    ? { label: 'Published', tone: 'success' }
    : { label: 'Draft', tone: 'warning' };
}
