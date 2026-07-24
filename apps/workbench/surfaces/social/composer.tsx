'use client';

// The composer — write one post, pick where it goes, see how it will read on each
// platform before it leaves, then save / schedule / send it.
//
// Writing a new post and editing a saved one are the SAME surface: `{id:'new'}`
// is the blank compose form, `{id}` is the post it becomes once saved. So this is
// a pane, not a modal — there is a durable draft to return to, and the whole
// point (the words, the destinations, the per-platform preview) fails the modal
// test outright.
//
// One caveat shapes the two states: the destinations (and any per-destination
// tweak) are chosen when the post is first created — that is the only call that
// accepts them. So you pick destinations while writing a new post; once it is
// saved, the destinations are shown as they stand, and editing is about the words
// and pictures. This mirrors the server, which only lets a draft's body/link/
// media change after creation.
//
// The audience owns a business, not a social console. A "destination" is a page
// or profile a post lands on; a platform's limit is "24 characters over — it will
// be cut short here", never a raw error.

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  CalendarClock,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { MediaPickerProvider, AssetField } from '../cms/media-picker';
import { useMediaAssets, type MediaAsset } from '../cms/media';
import { PostPreview } from './post-preview';
import {
  canApprove,
  canCompose,
  catalogByPlatform,
  evaluateTarget,
  isEditablePost,
  platformName,
  postStatusMeta,
  socialErrorMessage,
  targetStatusMeta,
  useApprovePost,
  useComposePost,
  useDeletePost,
  usePublishPost,
  useRejectPost,
  useSchedulePost,
  useSocialOverview,
  useSocialPost,
  useSubmitPost,
  useUpdatePost,
  type CatalogEntry,
  type ComposeAction,
  type ComposeTarget,
  type Post,
  type PostTarget,
  type SocialPlatform,
} from './data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** A chooseable destination, flattened from the connected accounts. */
interface Destination {
  targetId: string;
  name: string;
  platform: SocialPlatform;
  accountName: string;
  /** The page/profile picture, so a preview reads as that account at a glance. */
  avatarUrl: string | null;
}

/** "Instagram", "Instagram and TikTok", "Instagram, TikTok and Pinterest" — a plain
 *  sentence-ready list, because a business owner reads prose, not an array. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The wording that actually reaches a destination: its per-destination override
 *  when it has one, else the shared body. An EMPTY override falls through to the
 *  body, which is why this cannot be a `??`. */
function effectiveText(override: string | undefined, base: string): string {
  const trimmed = override?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : base;
}

/** A post's opening words, for the pane's tab title. */
function titleFor(body: string): string {
  const line = body.trim().split('\n')[0]?.slice(0, 40).trim();
  return line && line.length > 0 ? line : 'Post';
}

/* ── Per-destination preview note ─────────────────────────────────────────── */

function PreviewNotes({
  constraints,
  text,
  mediaCount,
}: {
  constraints: CatalogEntry['constraints'] | undefined;
  text: string;
  mediaCount: number;
}) {
  const preview = evaluateTarget(constraints, text, mediaCount);
  if (preview.notes.length === 0) {
    return (
      <span className="text-success inline-flex items-center gap-1 text-sm">
        <Check className="size-3.5" aria-hidden />
        Reads fine here.
      </span>
    );
  }
  const tone = preview.level === 'block' ? 'text-error' : 'text-warning';
  return (
    <ul className={`flex flex-col gap-0.5 text-sm ${tone}`}>
      {preview.notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

/* ── Read-only media thumbnails (for a saved/sent post) ───────────────────── */

function MediaThumbs({ ids }: { ids: string[] }) {
  const assets = useMediaAssets(ids);
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const asset = assets.data?.find((a) => a.id === id);
        return (
          <div
            key={id}
            className="border-base-300 bg-base-200 relative size-20 shrink-0 overflow-hidden rounded-lg border"
          >
            {asset?.url ? (
              <Image
                src={asset.url}
                alt={asset.filename}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full items-center justify-center">
                <ImageIcon className="size-5" aria-hidden />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Per-destination result (read-only, for a saved/sent post) ────────────── */

function TargetResults({ targets }: { targets: PostTarget[] }) {
  if (targets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {targets.map((target) => {
        const meta = targetStatusMeta(target.status);
        return (
          <div
            key={target.id}
            className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{target.targetName}</span>
            <Badge color={meta.tone} variant="soft" size="sm">
              {meta.label}
            </Badge>
            {target.permalink ? (
              <a
                href={target.permalink}
                target="_blank"
                rel="noreferrer noopener"
                className="text-module inline-flex items-center gap-0.5 text-sm underline"
              >
                View
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
            {target.status === 'failed' && target.error ? (
              <Text className="text-error w-full text-sm">{target.error}</Text>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   WRITE A NEW POST
   ══════════════════════════════════════════════════════════════════════════ */

function ComposeNew({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const viewer = useViewer();
  const overview = useSocialOverview();
  const compose = useComposePost();

  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<
    Record<string, { textOverride: string; firstComment: string }>
  >({});
  const [scheduleLocal, setScheduleLocal] = useState('');

  useEffect(() => {
    ctx.setTitle('New post');
  }, [ctx]);

  const isAdmin = canApprove(viewer.data?.role);
  const requireApproval = overview.data?.settings.requireApproval ?? true;
  const catalogMap = useMemo(
    () => catalogByPlatform(overview.data?.catalog ?? []),
    [overview.data]
  );

  const destinations = useMemo<Destination[]>(() => {
    const out: Destination[] = [];
    for (const connection of overview.data?.connections ?? []) {
      if (connection.status !== 'active') continue;
      const accountName = connection.displayName ?? platformName(connection.platform, catalogMap);
      for (const target of connection.targets) {
        if (!target.enabled) continue;
        out.push({
          targetId: target.id,
          name: target.name,
          platform: connection.platform,
          accountName,
          avatarUrl: target.avatarUrl ?? connection.avatarUrl,
        });
      }
    }
    return out;
  }, [overview.data, catalogMap]);

  const dirty =
    body.trim() !== '' || link.trim() !== '' || mediaIds.length > 0 || selected.size > 0;
  useDirtySource(dirty && !compose.isSuccess, 'This post has not been saved yet. Close anyway?');

  // Resolve the picked media so the previews can render the REAL image, cropped to each
  // platform's shape. Kept in the author's chosen order (the query returns whatever
  // order it likes; order decides which image leads a carousel).
  const mediaAssets = useMediaAssets(mediaIds);
  const orderedAssets = useMemo<MediaAsset[]>(() => {
    const byId = new Map((mediaAssets.data ?? []).map((a) => [a.id, a]));
    return mediaIds.map((id) => byId.get(id)).filter((a): a is MediaAsset => a !== undefined);
  }, [mediaIds, mediaAssets.data]);

  const selectedDestinations = destinations.filter((d) => selected.has(d.targetId));
  const previews = selectedDestinations.map((dest) => {
    const constraints = catalogMap.get(dest.platform)?.constraints;
    const text = effectiveText(overrides[dest.targetId]?.textOverride, body);
    return { dest, preview: evaluateTarget(constraints, text, mediaIds.length) };
  });
  const hasBlock = previews.some((p) => p.preview.level === 'block');

  const composeTargets: ComposeTarget[] = selectedDestinations.map((dest) => {
    const ov = overrides[dest.targetId];
    return {
      targetId: dest.targetId,
      ...(ov?.textOverride.trim() ? { textOverride: ov.textOverride.trim() } : {}),
      ...(ov?.firstComment.trim() ? { firstComment: ov.firstComment.trim() } : {}),
    };
  });

  const canSaveDraft = body.trim() !== '' && selected.size > 0 && !compose.isPending;
  const scheduleIso = fromLocalInput(scheduleLocal);
  const scheduleValid = scheduleIso !== null && new Date(scheduleIso).getTime() > Date.now();

  const toggle = (targetId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  };

  const run = (action: ComposeAction) => {
    if (!canSaveDraft) return;
    compose.mutate(
      {
        input: {
          body: body.trim(),
          link: link.trim() ? link.trim() : null,
          mediaAssetIds: mediaIds,
          source: 'manual',
          targets: composeTargets,
        },
        action,
        ...(action === 'schedule' && scheduleIso ? { scheduledAt: scheduleIso } : {}),
      },
      {
        onSuccess: (post) => {
          ctx.open('social.composer', { id: post.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({
              title:
                action === 'draft'
                  ? 'Draft saved'
                  : action === 'submit'
                    ? 'Sent for approval'
                    : action === 'schedule'
                      ? 'Post scheduled'
                      : 'Publishing now',
              type: 'success',
            });
          });
        },
      }
    );
  };

  const failure = compose.isError
    ? socialErrorMessage(compose.error, 'Nothing was saved. Please try again.')
    : null;

  if (!canCompose(viewer.data?.role)) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color="info" variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>You cannot write posts</AlertTitle>
              <AlertDescription>
                Writing and scheduling posts needs an editor or admin role. Ask a teammate with
                those permissions.
              </AlertDescription>
            </AlertContent>
          </Alert>
        </div>
      </div>
    );
  }

  // Media is REQUIRED the moment a destination that demands it is selected. The label
  // has to say so — calling it "optional" and letting the post fail later is the bug.
  const mediaRequiredBy = selectedDestinations.filter(
    (d) => catalogMap.get(d.platform)?.constraints.requiresMedia
  );
  const mediaMissing = mediaIds.length === 0 && mediaRequiredBy.length > 0;

  // Nowhere to post yet. NOT a banner above a form that cannot be submitted — the one
  // thing to do IS connecting an account, so it is the whole screen.
  if (overview.isSuccess && destinations.length === 0) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-start gap-4">
            <Heading level={1} className="text-2xl font-semibold">
              Connect an account to start posting
            </Heading>
            <Text>
              There is nowhere for a post to go yet. Connect a page or profile — your Facebook Page,
              Instagram, Google Business listing — and it shows up here as a destination you can
              write to.
            </Text>
            <Button
              color="module"
              onClick={() => {
                ctx.open('social.connections');
              }}
            >
              Connect an account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="New post actions">
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          loading={compose.isPending && compose.variables?.action === 'draft'}
          disabled={!canSaveDraft}
          onClick={() => {
            run('draft');
          }}
        >
          <Save className="size-4" aria-hidden />
          Save draft
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Split studio: compose on the left, what it will ACTUALLY look like on the
            right. Stacks to one column below lg so the composer works on a phone. */}
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Write a post
              </Heading>
              <Text>
                Write it once, choose where it goes, and see exactly how it lands on each account
                before it leaves.
              </Text>
            </div>

            {failure ? (
              <Alert color="error" variant="soft">
                <AlertContent>
                  <AlertTitle>Could not save this post</AlertTitle>
                  <AlertDescription>{failure}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}

            {/* MEDIA FIRST. Most of these platforms are pictures-and-video first, and four
              of them refuse a post without one — so this leads, and its label reflects
              the CURRENT selection instead of always saying "optional". */}
            <FormSection title="Pictures and video">
              <Field>
                <FieldLabel>
                  {mediaRequiredBy.length > 0 ? 'Required for this post' : 'Add a picture or video'}
                </FieldLabel>
                <AssetField
                  multiple
                  value={mediaIds}
                  onChange={(next) => {
                    setMediaIds(Array.isArray(next) ? (next as string[]) : []);
                  }}
                />
                <FieldDescription>
                  {mediaMissing ? (
                    <span className="text-error font-medium">
                      {listNames(mediaRequiredBy.map((d) => platformName(d.platform, catalogMap)))}{' '}
                      will not post without one.
                    </span>
                  ) : mediaRequiredBy.length > 0 ? (
                    <>
                      Needed by{' '}
                      {listNames(mediaRequiredBy.map((d) => platformName(d.platform, catalogMap)))}{' '}
                      — the preview shows how each one crops it.
                    </>
                  ) : (
                    <>
                      Optional for the accounts you have picked, but a picture is what gets a post
                      seen. The preview shows how each account crops it.
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FormSection>

            <FormSection title="Your words">
              <Field>
                <FieldLabel>What do you want to say?</FieldLabel>
                <FieldControl
                  render={
                    <Textarea
                      color="module"
                      rows={5}
                      value={body}
                      placeholder="Share news, an offer, or what you are up to…"
                      onChange={(event) => {
                        setBody(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  {body.length.toLocaleString()} {body.length === 1 ? 'character' : 'characters'} ·
                  the preview shows anything an account will cut.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Add a link (optional)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={link}
                      placeholder="https://yourbusiness.com/news"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setLink(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  A page you want people to visit. Each account treats a link differently — the
                  preview shows which.
                </FieldDescription>
              </Field>
            </FormSection>

            {destinations.length > 0 ? (
              <FormSection
                title="Where it goes"
                description="Pick the pages and profiles this post should land on. Each shows how it will read there."
              >
                <div className="flex flex-col gap-2">
                  {destinations.map((dest) => {
                    const on = selected.has(dest.targetId);
                    const constraints = catalogMap.get(dest.platform)?.constraints;
                    const text = effectiveText(overrides[dest.targetId]?.textOverride, body);
                    return (
                      <div
                        key={dest.targetId}
                        className="border-base-300 flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            color="module"
                            size="sm"
                            className="mt-0.5"
                            checked={on}
                            aria-label={`Post to ${dest.name}`}
                            onChange={() => {
                              toggle(dest.targetId);
                            }}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-medium">{dest.name}</span>
                            <span className="text-sm">
                              {platformName(dest.platform, catalogMap)}
                            </span>
                          </span>
                        </label>
                        {on && body.trim() !== '' ? (
                          <div className="pl-8">
                            <PreviewNotes
                              constraints={constraints}
                              text={text}
                              mediaCount={mediaIds.length}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            ) : null}

            {selectedDestinations.length > 0 ? (
              <FormSection
                title="Fine-tune per destination (optional)"
                description="Leave these blank to use the same words everywhere. Set them only where one account needs something different."
              >
                <div className="flex flex-col gap-4">
                  {selectedDestinations.map((dest) => {
                    const ov = overrides[dest.targetId] ?? { textOverride: '', firstComment: '' };
                    return (
                      <div key={dest.targetId} className="flex flex-col gap-2">
                        <Text className="text-sm font-semibold">{dest.name}</Text>
                        <Textarea
                          color="module"
                          rows={2}
                          value={ov.textOverride}
                          placeholder="Different wording just for this account…"
                          aria-label={`Different wording for ${dest.name}`}
                          onChange={(event) => {
                            setOverrides((current) => ({
                              ...current,
                              [dest.targetId]: { ...ov, textOverride: event.target.value },
                            }));
                          }}
                        />
                        <Input
                          color="module"
                          value={ov.firstComment}
                          placeholder="First comment (e.g. your hashtags)…"
                          aria-label={`First comment for ${dest.name}`}
                          onChange={(event) => {
                            setOverrides((current) => ({
                              ...current,
                              [dest.targetId]: { ...ov, firstComment: event.target.value },
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </FormSection>
            ) : null}

            <FormSection title="Ready to send?">
              {selected.size === 0 ? (
                <Text className="text-sm">Pick at least one destination above first.</Text>
              ) : (
                <div className="flex flex-col gap-4">
                  {hasBlock ? (
                    <Alert color="warning" variant="soft">
                      <AlertContent>
                        <AlertTitle>One destination needs a fix first</AlertTitle>
                        <AlertDescription>
                          A destination above cannot post as things stand — add what it needs, or
                          turn it off for this post. You can still save a draft.
                        </AlertDescription>
                      </AlertContent>
                    </Alert>
                  ) : null}

                  {requireApproval ? (
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <Text className="text-sm">
                        Approval is on, so a post you schedule or submit waits for an admin before
                        it goes live.
                      </Text>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <Field className="min-w-0">
                        <FieldLabel>Schedule for later</FieldLabel>
                        <FieldControl
                          render={
                            <Input
                              color="module"
                              type="datetime-local"
                              className="max-w-xs"
                              value={scheduleLocal}
                              onChange={(event) => {
                                setScheduleLocal(event.target.value);
                              }}
                            />
                          }
                        />
                      </Field>
                      <Button
                        size="sm"
                        variant="outline"
                        color="module"
                        loading={compose.isPending && compose.variables?.action === 'schedule'}
                        disabled={!canSaveDraft || !scheduleValid || hasBlock}
                        onClick={() => {
                          run('schedule');
                        }}
                      >
                        <CalendarClock className="size-4" aria-hidden />
                        Schedule
                      </Button>
                    </div>

                    <div className="border-base-300 flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        color="module"
                        variant="outline"
                        loading={compose.isPending && compose.variables?.action === 'submit'}
                        disabled={!canSaveDraft || hasBlock}
                        onClick={() => {
                          run('submit');
                        }}
                      >
                        <Send className="size-4" aria-hidden />
                        Submit for approval
                      </Button>
                      {isAdmin ? (
                        <Button
                          size="sm"
                          color="module"
                          loading={compose.isPending && compose.variables?.action === 'publish'}
                          disabled={!canSaveDraft || hasBlock}
                          onClick={() => {
                            run('publish');
                          }}
                        >
                          <Send className="size-4" aria-hidden />
                          Publish now
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </FormSection>
          </div>

          {/* The payoff: the real thing, per account, as you type. Sticky on desktop so
              it stays in view while the words change; just follows the flow on mobile. */}
          <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-4 lg:w-[400px] lg:shrink-0">
            <div className="flex flex-col gap-1">
              <Heading level={2} className="text-base font-semibold">
                How it will look
              </Heading>
              <Text className="text-sm">
                {selectedDestinations.length === 0
                  ? 'Pick a destination and its preview appears here.'
                  : 'Cropped to each account’s shape, cut to its limit.'}
              </Text>
            </div>

            {selectedDestinations.length === 0 ? (
              <div className="border-base-300 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center">
                <ImageIcon className="size-6" aria-hidden />
                <Text className="text-sm">No destinations picked yet.</Text>
              </div>
            ) : (
              selectedDestinations.map((dest) => {
                const ov = overrides[dest.targetId];
                return (
                  <PostPreview
                    key={dest.targetId}
                    platform={dest.platform}
                    platformLabel={platformName(dest.platform, catalogMap)}
                    destinationName={dest.name}
                    avatarUrl={dest.avatarUrl}
                    constraints={catalogMap.get(dest.platform)?.constraints}
                    text={effectiveText(ov?.textOverride, body)}
                    link={link.trim() || undefined}
                    firstComment={ov?.firstComment}
                    media={orderedAssets}
                  />
                );
              })
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MANAGE A SAVED POST
   ══════════════════════════════════════════════════════════════════════════ */

function ComposeManage({ ctx, post }: { ctx: SurfaceContext; post: Post }) {
  const toast = useToast();
  const confirm = useConfirm();
  const viewer = useViewer();
  const overview = useSocialOverview();
  const id = post.id;

  const update = useUpdatePost(id);
  const submit = useSubmitPost(id);
  const schedule = useSchedulePost(id);
  const approve = useApprovePost(id);
  const reject = useRejectPost(id);
  const publish = usePublishPost(id);
  const remove = useDeletePost(id);

  const [body, setBody] = useState(post.body);
  const [link, setLink] = useState(post.link ?? '');
  const [mediaIds, setMediaIds] = useState<string[]>(post.mediaAssetIds);
  const [scheduleLocal, setScheduleLocal] = useState('');

  const isAdmin = canApprove(viewer.data?.role);
  const canWrite = canCompose(viewer.data?.role);
  const editable = isEditablePost(post.status);
  const meta = postStatusMeta(post.status);
  const catalogMap = useMemo(
    () => catalogByPlatform(overview.data?.catalog ?? []),
    [overview.data]
  );

  useEffect(() => {
    ctx.setTitle(titleFor(post.body));
  }, [ctx, post.body]);

  const changed =
    body !== post.body ||
    link !== (post.link ?? '') ||
    mediaIds.join(',') !== post.mediaAssetIds.join(',');
  useDirtySource(editable && changed, 'This post has unsaved changes. Close anyway?');

  const scheduleIso = fromLocalInput(scheduleLocal);
  const scheduleValid = scheduleIso !== null && new Date(scheduleIso).getTime() > Date.now();

  const actionError = useMemo(() => {
    const failed = [update, submit, schedule, approve, reject, publish, remove].find(
      (m) => m.isError
    );
    if (!failed) return null;
    return socialErrorMessage(failed.error, 'That did not go through. Nothing was changed.');
  }, [update, submit, schedule, approve, reject, publish, remove]);

  const saveChanges = () => {
    if (!changed) return;
    update.mutate(
      { body: body.trim(), link: link.trim() ? link.trim() : null, mediaAssetIds: mediaIds },
      {
        onSuccess: () => {
          toast.add({ title: 'Changes saved', type: 'success' });
        },
      }
    );
  };

  const doSubmit = () => {
    submit.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Sent for approval', type: 'success' });
      },
    });
  };

  const doSchedule = () => {
    if (!scheduleIso || !scheduleValid) return;
    schedule.mutate(scheduleIso, {
      onSuccess: (updated) => {
        toast.add({
          title: updated.status === 'scheduled' ? 'Scheduled' : 'Scheduled, awaiting approval',
          description: updated.scheduledAt
            ? `Goes out ${formatWhen(updated.scheduledAt)}.`
            : undefined,
          type: 'success',
        });
      },
    });
  };

  const doApprove = () => {
    approve.mutate(undefined, {
      onSuccess: (updated) => {
        toast.add({
          title: updated.status === 'scheduled' ? 'Approved and scheduled' : 'Approved — going out',
          type: 'success',
        });
      },
    });
  };

  const doReject = () => {
    void (async () => {
      const ok = await confirm({
        title: 'Send this post back?',
        description:
          'It goes back to a draft so it can be changed and submitted again. Nothing is posted.',
        confirmLabel: 'Send it back',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      reject.mutate(undefined, {
        onSuccess: () => {
          toast.add({ title: 'Sent back to draft', type: 'success' });
        },
      });
    })();
  };

  const doPublish = () => {
    publish.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Publishing now', type: 'success' });
      },
    });
  };

  const doDelete = () => {
    void (async () => {
      const ok = await confirm({
        title: 'Delete this post?',
        description:
          'This removes the post and its schedule for good. Anything already posted to your accounts stays live there. This cannot be undone.',
        confirmLabel: 'Delete it',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      remove.mutate(undefined, {
        onSuccess: () => {
          ctx.close();
          afterPaneChange(() => {
            toast.add({ title: 'Post deleted', type: 'success' });
          });
        },
      });
    })();
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Post actions" wrap>
        <Badge color={meta.tone} variant="soft" size="sm">
          {meta.label}
        </Badge>
        <div className="flex-1" />
        {editable && canWrite ? (
          <Button
            color="module"
            size="sm"
            disabled={!changed || update.isPending}
            loading={update.isPending}
            onClick={saveChanges}
          >
            <Save className="size-4" aria-hidden />
            Save changes
          </Button>
        ) : null}
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              {post.status === 'draft' ? 'Draft post' : 'Post'}
            </Heading>
            <Text className="text-sm">{meta.detail}</Text>
          </div>

          {actionError ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>That did not go through</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {editable && canWrite ? (
            <FormSection title="Your post">
              <Field>
                <FieldLabel>What do you want to say?</FieldLabel>
                <FieldControl
                  render={
                    <Textarea
                      color="module"
                      rows={5}
                      value={body}
                      onChange={(event) => {
                        setBody(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  {body.length.toLocaleString()} {body.length === 1 ? 'character' : 'characters'}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Link (optional)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={link}
                      placeholder="https://yourbusiness.com/news"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setLink(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Pictures or video (optional)</FieldLabel>
                <AssetField
                  multiple
                  value={mediaIds}
                  onChange={(next) => {
                    setMediaIds(Array.isArray(next) ? (next as string[]) : []);
                  }}
                />
              </Field>
            </FormSection>
          ) : (
            <FormSection title="Your post">
              <Text className="whitespace-pre-wrap">{post.body}</Text>
              {post.link ? (
                <a
                  href={post.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-module inline-flex items-center gap-0.5 text-sm underline"
                >
                  {post.link}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              <MediaThumbs ids={post.mediaAssetIds} />
            </FormSection>
          )}

          <FormSection
            title="Where it goes"
            description="The accounts this post was set up to reach, and how each is doing."
          >
            {post.targets.length === 0 ? (
              <Text className="text-sm">This post has no destinations.</Text>
            ) : editable && canWrite ? (
              <div className="flex flex-col gap-2">
                {post.targets.map((target) => {
                  const constraints = catalogMap.get(target.platform)?.constraints;
                  return (
                    <div
                      key={target.id}
                      className="border-base-300 flex flex-col gap-1 border-b py-2 last:border-b-0"
                    >
                      <span className="font-medium">{target.targetName}</span>
                      <PreviewNotes
                        constraints={constraints}
                        text={body}
                        mediaCount={mediaIds.length}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <TargetResults targets={post.targets} />
            )}
          </FormSection>

          {/* Lifecycle actions — only while the post can still move. */}
          {editable && canWrite ? (
            <FormSection title="Send">
              <div className="flex flex-col gap-4">
                {post.status === 'pending_approval' && isAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      color="module"
                      loading={approve.isPending}
                      onClick={doApprove}
                    >
                      <Check className="size-4" aria-hidden />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      color="danger"
                      loading={reject.isPending}
                      onClick={doReject}
                    >
                      <X className="size-4" aria-hidden />
                      Send back
                    </Button>
                  </div>
                ) : null}

                {post.status === 'draft' ? (
                  <Button
                    size="sm"
                    color="module"
                    variant="outline"
                    className="self-start"
                    loading={submit.isPending}
                    onClick={doSubmit}
                  >
                    <Send className="size-4" aria-hidden />
                    Submit for approval
                  </Button>
                ) : null}

                <div className="flex flex-wrap items-end gap-3">
                  <Field className="min-w-0">
                    <FieldLabel>
                      {post.scheduledAt ? 'Change the time' : 'Schedule for later'}
                    </FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          type="datetime-local"
                          className="max-w-xs"
                          value={scheduleLocal}
                          onChange={(event) => {
                            setScheduleLocal(event.target.value);
                          }}
                        />
                      }
                    />
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    color="module"
                    disabled={!scheduleValid || schedule.isPending}
                    loading={schedule.isPending}
                    onClick={doSchedule}
                  >
                    <CalendarClock className="size-4" aria-hidden />
                    {post.scheduledAt ? 'Reschedule' : 'Schedule'}
                  </Button>
                </div>
                {post.scheduledAt ? (
                  <Text className="text-sm">Currently set for {formatWhen(post.scheduledAt)}.</Text>
                ) : null}

                {isAdmin ? (
                  <div className="border-base-300 border-t pt-3">
                    <Button
                      size="sm"
                      color="module"
                      loading={publish.isPending}
                      onClick={doPublish}
                    >
                      <Send className="size-4" aria-hidden />
                      {post.status === 'failed' ? 'Try publishing again' : 'Publish now'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </FormSection>
          ) : null}

          {/* Delete — a rare, irreversible action, kept apart under a divider. */}
          {isAdmin && post.status !== 'publishing' ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">
                Remove this post and its schedule. Anything already posted stays live on your
                accounts.
              </Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                loading={remove.isPending}
                onClick={doDelete}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete post
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   THE PANE
   ══════════════════════════════════════════════════════════════════════════ */

function ComposerInner({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const post = useSocialPost(id);

  if (id === 'new') return <ComposeNew ctx={ctx} />;

  if (post.isError) {
    const gone = post.error instanceof Error && 'status' in post.error && post.error.status === 404;
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color={gone ? 'warning' : 'error'} variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>
                {gone ? 'This post no longer exists' : 'Could not load this post'}
              </AlertTitle>
              <AlertDescription>
                {gone
                  ? 'It may have been deleted. Nothing else is affected.'
                  : 'This is a problem reaching the server. Nothing about the post has changed.'}
              </AlertDescription>
            </AlertContent>
            {gone ? null : (
              <Button
                size="sm"
                color="error"
                variant="soft"
                onClick={() => {
                  void post.refetch();
                }}
              >
                Try again
              </Button>
            )}
          </Alert>
        </div>
      </div>
    );
  }

  if (post.isPending || !post.data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-base" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return <ComposeManage key={post.data.id} ctx={ctx} post={post.data} />;
}

export function SocialComposerSurface({ ctx }: { ctx: SurfaceContext }) {
  // The media browser is mounted once here so the compose fields can open it.
  return (
    <MediaPickerProvider>
      <ComposerInner ctx={ctx} />
    </MediaPickerProvider>
  );
}

export default SocialComposerSurface;
