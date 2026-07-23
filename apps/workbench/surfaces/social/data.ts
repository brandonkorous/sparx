'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SOCIAL-POSTING DATA LAYER
//
// One place your business posts to every social account it has connected —
// Google Business, LinkedIn and, as they roll out, Facebook, Instagram and the
// rest. You write a post once; sparx sends it to each account you pick, in that
// account's own shape.
//
// This file is the ONE door to the social API in api-rest. All four surfaces —
// Connections, the Composer, the Queue and the Approvals inbox — read and write
// through here, so the cache keys and the typed wire shapes live in one place
// and never drift apart.
//
// ── The endpoints (services/api-rest/.../v1/social) ────────────────────────
//   GET    /v1/social                     → { connections, catalog, settings }
//   GET    /v1/social/:platform/connect-url?redirect_uri=… → { url }  (admin)
//   POST   /v1/social/callback            → finish an OAuth connect     (admin)
//   PATCH  /v1/social/targets/:id         → turn one destination on/off (admin)
//   DELETE /v1/social/:platform           → disconnect a platform       (admin)
//   PATCH  /v1/social/settings            → the require-approval default (admin)
//   POST   /v1/social/posts               → save a draft + its targets  (editor)
//   GET    /v1/social/posts?status=…      → the queue / inbox           (viewer)
//   GET    /v1/social/posts/:id           → one post + per-target status (viewer)
//   PATCH  /v1/social/posts/:id           → edit a draft                (editor)
//   POST   /v1/social/posts/:id/submit    → draft → awaiting approval    (editor)
//   POST   /v1/social/posts/:id/schedule  → set a future time           (editor)
//   POST   /v1/social/posts/:id/approve   → approve (→ scheduled/publish) (admin)
//   POST   /v1/social/posts/:id/reject    → reject (→ draft)             (admin)
//   POST   /v1/social/posts/:id/publish   → publish now                 (admin)
//   DELETE /v1/social/posts/:id           → delete                      (admin)
//
// ── The key contract ───────────────────────────────────────────────────────
//   ['social']                       the root every read nests under
//   ['social','overview']            connections + platform catalog + settings
//   ['social','posts', {status}]     the queue / inbox, optionally by status
//   ['social','posts','detail', id]  one post, in full
//
// A connection write invalidates the ['social'] ROOT (connections AND the
// composer's target list move together); a post write invalidates the posts
// sub-tree so the queue, the inbox and the open composer all refresh at once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shared vocabulary ──────────────────────────────────────────────────── */

/** The platforms the module knows about. Kept open (a plain string) at the wire
 *  boundary so a platform the server adds later never breaks the type — display
 *  names always come from the catalog payload, never a hardcoded table. */
export type SocialPlatform = string;

/** A semantic tone for a `<Badge color>` — status is its own colour axis. */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/* ── Connections ────────────────────────────────────────────────────────── */

/** One concrete destination a connection unlocks — a specific Facebook Page, a
 *  LinkedIn company page, a Google Business location. The tenant turns each on
 *  or off individually. */
export interface SocialTarget {
  id: string;
  externalTargetId: string;
  name: string;
  avatarUrl: string | null;
  enabled: boolean;
}

export type ConnectionStatus = 'active' | 'expired' | 'revoked';

/** One connected account. A grant can carry several targets. */
export interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  status: ConnectionStatus;
  propertyId: string | null;
  displayName: string | null;
  externalId: string | null;
  avatarUrl: string | null;
  connectedAt: string;
  targets: SocialTarget[];
}

/** The posting rules for one platform — the composer validates against these at
 *  author time, so "too long for X" shows before anything is scheduled. */
export interface PlatformConstraints {
  maxTextLength: number;
  maxMediaCount: number;
  supportedMedia: ('image' | 'video')[];
  requiresMedia: boolean;
  aspectRatios?: string[];
}

export type PlatformPhase = 'v1' | 'Phase 2' | 'Phase 3';
export type PlatformAvailability = 'available' | 'coming_soon';

/** A platform you could connect, with its display copy and posting rules. */
export interface CatalogEntry {
  platform: SocialPlatform;
  name: string;
  blurb: string;
  phase: PlatformPhase;
  availability: PlatformAvailability;
  constraints: PlatformConstraints;
}

export interface SocialSettings {
  requireApproval: boolean;
}

/** The everything-view GET /v1/social returns. */
export interface SocialOverview {
  connections: SocialConnection[];
  catalog: CatalogEntry[];
  settings: SocialSettings;
}

/* ── Posts ──────────────────────────────────────────────────────────────── */

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed';

export type PostTargetStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'skipped';

/** One post's fan-out to a single destination, with that destination's own
 *  result once it publishes. */
export interface PostTarget {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: SocialPlatform;
  status: PostTargetStatus;
  externalId: string | null;
  permalink: string | null;
  error: string | null;
  publishedAt: string | null;
}

export interface Post {
  id: string;
  propertyId: string | null;
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  status: PostStatus;
  source: string;
  sourceRef: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: PostTarget[];
}

/** The per-target instruction sent when composing — a base post can carry a
 *  tweak for one platform without changing it for the others. */
export interface ComposeTarget {
  targetId: string;
  textOverride?: string;
  firstComment?: string;
}

export interface CreatePostInput {
  body: string;
  link?: string | null;
  mediaAssetIds?: string[];
  source?: string;
  sourceRef?: string | null;
  targets: ComposeTarget[];
}

export interface UpdatePostInput {
  body?: string;
  link?: string | null;
  mediaAssetIds?: string[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const socialKeys = {
  all: ['social'] as const,
  overview: ['social', 'overview'] as const,
  posts: (status?: string) => ['social', 'posts', { status: status ?? null }] as const,
  post: (id: string) => ['social', 'posts', 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Connections, the connectable-platform catalog, and the approval setting — one
 *  request behind the Connections surface AND the composer's destination list. */
export function useSocialOverview() {
  return useQuery({
    queryKey: socialKeys.overview,
    queryFn: () => api.get<SocialOverview>('/v1/social'),
  });
}

/** The queue / inbox. `status` filters server-side; omit it for everything. */
export function useSocialPosts(status?: PostStatus) {
  return useQuery({
    queryKey: socialKeys.posts(status),
    queryFn: () =>
      api
        .get<{ posts: Post[] }>('/v1/social/posts', status ? { status } : undefined)
        .then((r) => r.posts),
  });
}

export function useSocialPost(id: string) {
  return useQuery({
    queryKey: socialKeys.post(id),
    queryFn: () => api.get<Post>(`/v1/social/posts/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidateOverview() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: socialKeys.overview });
  };
}

function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    // The ['social','posts'] prefix covers every status filter AND every detail
    // at once, so one write refreshes the queue, the inbox and the open composer.
    void queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: socialKeys.post(id) });
  };
}

/* ── Connection mutations ───────────────────────────────────────────────── */

/** Ask the server for the platform's consent URL to send the owner to.
 *  `redirectUri` is the page on this app that hands the code back (a popup). */
export function useConnectUrl() {
  return useMutation({
    mutationFn: ({ platform, redirectUri }: { platform: SocialPlatform; redirectUri: string }) =>
      api.get<{ url: string }>(`/v1/social/${platform}/connect-url`, { redirect_uri: redirectUri }),
  });
}

/** Finish an OAuth connect: trade the returned code + state for a stored,
 *  encrypted grant and its discovered destinations. */
export function useCompleteConnect() {
  const invalidate = useInvalidateOverview();
  return useMutation({
    mutationFn: (input: { code: string; state: string }) =>
      api.post<{
        connected: boolean;
        platform: SocialPlatform;
        externalId: string | null;
        targets: SocialTarget[];
      }>('/v1/social/callback', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Turn one destination on or off. */
export function useToggleTarget() {
  const invalidate = useInvalidateOverview();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch<{ id: string; enabled: boolean }>(`/v1/social/targets/${id}`, { enabled }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Disconnect every connection for a platform. Destinations cascade away. */
export function useDisconnectPlatform() {
  const invalidate = useInvalidateOverview();
  return useMutation({
    mutationFn: (platform: SocialPlatform) => api.delete(`/v1/social/${platform}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Set whether posts need an admin's approval before they go live. */
export function useSetRequireApproval() {
  const invalidate = useInvalidateOverview();
  return useMutation({
    mutationFn: (requireApproval: boolean) =>
      api.patch<{ settings: SocialSettings }>('/v1/social/settings', { requireApproval }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Post mutations ─────────────────────────────────────────────────────── */

export function useCreatePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.post<Post>('/v1/social/posts', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** What to do with a freshly composed post, in one click from the composer's
 *  `new` state: keep it as a draft, send it for approval, schedule it, or (for an
 *  admin) publish it now. */
export type ComposeAction = 'draft' | 'submit' | 'schedule' | 'publish';

/**
 * Create a post and, in the same step, move it where the operator asked. The
 * create endpoint always makes a draft (it is the only call that accepts the
 * chosen destinations + per-destination tweaks), so a one-click "schedule" is a
 * create followed by the matching lifecycle call — done here, behind the data
 * layer, so a surface never issues a raw request. Always resolves to the created
 * post so the composer can swap `{id:'new'}` → `{id}`.
 */
export function useComposePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: async ({
      input,
      action,
      scheduledAt,
    }: {
      input: CreatePostInput;
      action: ComposeAction;
      scheduledAt?: string;
    }): Promise<Post> => {
      const post = await api.post<Post>('/v1/social/posts', input);
      if (action === 'submit') {
        return api.post<Post>(`/v1/social/posts/${post.id}/submit`);
      }
      if (action === 'schedule' && scheduledAt) {
        return api.post<Post>(`/v1/social/posts/${post.id}/schedule`, { scheduledAt });
      }
      if (action === 'publish') {
        await api.post(`/v1/social/posts/${post.id}/publish`);
        return post;
      }
      return post;
    },
    onSuccess: (post) => {
      invalidate(post.id);
    },
  });
}

export function useUpdatePost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (input: UpdatePostInput) => api.patch<Post>(`/v1/social/posts/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useSubmitPost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () => api.post<Post>(`/v1/social/posts/${id}/submit`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useSchedulePost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (scheduledAt: string) =>
      api.post<Post>(`/v1/social/posts/${id}/schedule`, { scheduledAt }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useApprovePost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () => api.post<Post>(`/v1/social/posts/${id}/approve`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useRejectPost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () => api.post<Post>(`/v1/social/posts/${id}/reject`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function usePublishPost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () =>
      api.post<{ publishing: boolean; postId: string; targetCount: number }>(
        `/v1/social/posts/${id}/publish`
      ),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeletePost(id: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () => api.delete(`/v1/social/posts/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Roles (mirror the server's ranked gate, so a control never appears for
      someone the server will refuse) ──────────────────────────────────────── */

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

/** May this viewer compose, edit, submit and schedule? (Server bar: editor.) */
export function canCompose(role: string | undefined): boolean {
  return (ROLE_RANK[role ?? ''] ?? 0) >= 1;
}

/** May this viewer approve, publish now, connect accounts, and change the
 *  approval setting? (Server bar: admin.) Deleting a post is also admin-gated. */
export function canApprove(role: string | undefined): boolean {
  return (ROLE_RANK[role ?? ''] ?? 0) >= 2;
}

/* ── Presentation helpers (shared, so every surface speaks alike) ─────────── */

/** A post's status in plain words, with its own colour tone and a one-line note.
 *  Feeds `<Badge color={tone} variant="soft">` — status carries its own colour. */
export function postStatusMeta(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'published':
      return { label: 'Published', tone: 'success', detail: 'Live on every destination.' };
    case 'partially_published':
      return {
        label: 'Partly published',
        tone: 'warning',
        detail: 'Some destinations went out and some did not — see each one below.',
      };
    case 'publishing':
      return { label: 'Publishing', tone: 'info', detail: 'Going out to your accounts now.' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'info', detail: 'Waiting for its time to go out.' };
    case 'pending_approval':
      return {
        label: 'Awaiting approval',
        tone: 'warning',
        detail: 'An admin needs to approve this before it goes live.',
      };
    case 'failed':
      return {
        label: 'Failed',
        tone: 'error',
        detail: 'It could not be published. Nothing went out.',
      };
    default:
      return { label: 'Draft', tone: 'neutral', detail: 'Saved, but not sent anywhere yet.' };
  }
}

/** One destination's result in plain words + tone. */
export function targetStatusMeta(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'published':
      return { label: 'Published', tone: 'success' };
    case 'publishing':
      return { label: 'Publishing', tone: 'info' };
    case 'failed':
      return { label: 'Failed', tone: 'error' };
    case 'skipped':
      return { label: 'Skipped', tone: 'neutral' };
    default:
      return { label: 'Waiting', tone: 'neutral' };
  }
}

/** A connection's health in plain words. */
export function connectionStatusMeta(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Connected', tone: 'success' };
    case 'expired':
      return { label: 'Reconnect needed', tone: 'warning' };
    case 'revoked':
      return { label: 'Disconnected', tone: 'neutral' };
    default:
      return { label: status.replace(/_/g, ' '), tone: 'neutral' };
  }
}

/** The catalog entry for a platform, keyed for quick lookup. */
export function catalogByPlatform(catalog: CatalogEntry[]): Map<SocialPlatform, CatalogEntry> {
  return new Map(catalog.map((entry) => [entry.platform, entry]));
}

/** The display name for a platform, from the catalog — never hardcoded. Falls
 *  back to the raw slug tidied up if the catalog has not loaded. */
export function platformName(
  platform: SocialPlatform,
  byPlatform: Map<SocialPlatform, CatalogEntry>
): string {
  return byPlatform.get(platform)?.name ?? platform.replace(/_/g, ' ');
}

/** How one destination's post reads against its platform's rules, worked out at
 *  author time. `block` stops a publish (a platform that needs media has none);
 *  `warn` lets it through with a caution (text over the limit). */
export interface TargetPreview {
  level: 'ok' | 'warn' | 'block';
  /** Plain-language notes to show under the destination. */
  notes: string[];
  /** How many characters over the limit, when the text is too long. */
  overBy: number;
}

export function evaluateTarget(
  constraints: PlatformConstraints | undefined,
  text: string,
  mediaCount: number
): TargetPreview {
  if (!constraints) return { level: 'ok', notes: [], overBy: 0 };

  const notes: string[] = [];
  let level: TargetPreview['level'] = 'ok';
  let overBy = 0;

  if (text.length > constraints.maxTextLength) {
    overBy = text.length - constraints.maxTextLength;
    level = 'warn';
    notes.push(
      `${overBy.toLocaleString()} ${overBy === 1 ? 'character' : 'characters'} over the ${constraints.maxTextLength.toLocaleString()}-character limit — it will be cut short here.`
    );
  }

  if (constraints.requiresMedia && mediaCount === 0) {
    level = 'block';
    notes.push('This platform needs a picture or video — add one, or leave it off this post.');
  }

  if (mediaCount > constraints.maxMediaCount) {
    level = level === 'block' ? 'block' : 'warn';
    notes.push(
      `Takes at most ${constraints.maxMediaCount} ${constraints.maxMediaCount === 1 ? 'item' : 'items'} — only the first ${constraints.maxMediaCount} will be used.`
    );
  }

  if (mediaCount > 0 && constraints.aspectRatios && constraints.aspectRatios.length > 0) {
    notes.push(`Best shapes here: ${constraints.aspectRatios.join(', ')}.`);
  }

  return { level, notes, overBy };
}

/**
 * The server's own sentence for a 4xx, shown verbatim: these routes explain the
 * exact problem (a time in the past, a post with no destination, a platform not
 * ready) far better than anything guessed from a status code. A 5xx falls back
 * to the caller's wording.
 */
export function socialErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** Whether a post can still be edited / moved through the lifecycle. Mirrors the
 *  server's EDITABLE_STATUSES — once it is publishing or done, the composer is
 *  read-only. */
export function isEditablePost(status: string): boolean {
  return (
    status === 'draft' ||
    status === 'pending_approval' ||
    status === 'scheduled' ||
    status === 'failed'
  );
}
