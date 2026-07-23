'use client';

// Posts — everything you have drafted, scheduled, and sent, grouped by where it
// is in its life. This is the module's home: the working list you come back to,
// with a "New post" that opens the composer.
//
// A short one-line thing per row (the post's opening words, when it goes out,
// and how each destination did) reads far better as a card-with-rows than as a
// table that would invent columns to justify itself. The post's own words ARE
// the row; everything else is a note about it.

import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Heading, SearchInput, Text } from '@wizeworks/silicaui-react';
import { ExternalLink, Plus, Send, ServerCrash } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { ListEmptyState } from '../../components/list-empty-state';
import { useViewer } from '../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  canCompose,
  postStatusMeta,
  socialErrorMessage,
  targetStatusMeta,
  useSocialPosts,
  type Post,
  type PostStatus,
} from './data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A post's first words, tidied for a single-line preview. */
function excerpt(body: string): string {
  const first = body.trim().split('\n')[0] ?? '';
  return first.length > 120 ? `${first.slice(0, 117)}…` : first || 'Untitled post';
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The one time that matters for a post, in plain words. */
function whenLine(post: Post): string {
  if (post.publishedAt) return `Posted ${formatWhen(post.publishedAt)}`;
  if (post.scheduledAt) return `Goes out ${formatWhen(post.scheduledAt)}`;
  return `Saved ${formatWhen(post.createdAt)}`;
}

/* ── One post ─────────────────────────────────────────────────────────────── */

function PostRow({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const meta = postStatusMeta(post.status);
  const enabledTargets = post.targets;

  return (
    <li className="border-base-300 flex flex-col border-b last:border-b-0">
      <button
        type="button"
        className="hover:bg-base-200 flex w-full min-w-0 cursor-pointer flex-col gap-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="min-w-0 flex-1 text-base font-medium break-words">
            {excerpt(post.body)}
          </span>
          <Badge color={meta.tone} variant="soft" size="sm">
            {meta.label}
          </Badge>
        </div>
        <Text className="text-sm">
          {whenLine(post)} ·{' '}
          {enabledTargets.length === 1
            ? '1 destination'
            : `${String(enabledTargets.length)} destinations`}
        </Text>
      </button>

      {/* Per-destination result — a sibling of the row button, because a
          published destination carries a link and an anchor cannot live inside a
          button. */}
      {enabledTargets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3">
          {enabledTargets.map((target) => {
            const tmeta = targetStatusMeta(target.status);
            return (
              <span key={target.id} className="inline-flex items-center gap-1.5">
                <Badge color={tmeta.tone} variant="soft" size="sm">
                  {target.targetName}: {tmeta.label}
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
              </span>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

/* ── Grouping ─────────────────────────────────────────────────────────────── */

interface Group {
  key: string;
  title: string;
  statuses: PostStatus[];
}

// Ordered by what an operator most wants to see first: things needing a look,
// then what is queued, then drafts, then the archive of what has gone out.
const GROUPS: Group[] = [
  { key: 'review', title: 'Needs a look', statuses: ['pending_approval', 'failed'] },
  { key: 'queued', title: 'Going out', statuses: ['scheduled', 'publishing'] },
  { key: 'drafts', title: 'Drafts', statuses: ['draft'] },
  { key: 'sent', title: 'Posted', statuses: ['published', 'partially_published'] },
];

/* ── The surface ──────────────────────────────────────────────────────────── */

export function SocialQueueSurface({ ctx }: { ctx: SurfaceContext }) {
  const viewer = useViewer();
  const posts = useSocialPosts();
  const [search, setSearch] = useState('');

  const canWrite = canCompose(viewer.data?.role);
  const all = useMemo(() => posts.data ?? [], [posts.data]);

  const needle = search.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? all.filter((post) => post.body.toLowerCase().includes(needle)) : all),
    [all, needle]
  );

  const grouped = useMemo(() => {
    return GROUPS.map((group) => ({
      group,
      posts: matches.filter((post) => group.statuses.includes(post.status)),
    })).filter((section) => section.posts.length > 0);
  }, [matches]);

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('social.composer', { id: 'new' }, { target: targetFor(event) });
  };

  const openPost = (post: Post, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('social.composer', { id: post.id }, { target: targetFor(event) });
  };

  if (posts.isError) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            icon={<ServerCrash className="size-6" aria-hidden />}
            title="Could not load your posts"
            description={socialErrorMessage(
              posts.error,
              'This is a problem reaching the server. Nothing about your posts has changed.'
            )}
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void posts.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Posts list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search posts"
            placeholder="Search posts…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
          {needle
            ? `${String(matches.length)} of ${String(all.length)}`
            : all.length === 1
              ? '1 post'
              : `${String(all.length)} posts`}
        </p>
        {canWrite ? (
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0 whitespace-nowrap"
            title="Write a new post — hold Shift to open alongside, Alt for a new window"
            onClick={openNew}
          >
            <Plus className="size-4" aria-hidden />
            New post
          </Button>
        ) : null}
        <RefreshButton
          className={canWrite ? undefined : 'ml-auto'}
          isFetching={posts.isFetching}
          updatedAt={posts.data ? posts.dataUpdatedAt : undefined}
          onRefresh={() => {
            void posts.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {posts.isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : matches.length === 0 ? (
          <ListEmptyState
            filtered={needle !== ''}
            noResults={{
              icon: <Send className="size-6" aria-hidden />,
              title: 'No posts match that',
              description: 'Try different words, or clear the search to see them all.',
            }}
            firstRun={{
              title: 'No posts yet',
              description:
                'Write a post once and send it to every account you have connected. Drafts, scheduled posts and everything you have already sent will show up here.',
              actions: canWrite ? (
                <Button color="module" size="sm" onClick={openNew}>
                  <Plus className="size-4" aria-hidden />
                  New post
                </Button>
              ) : undefined,
            }}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {grouped.map(({ group, posts: groupPosts }) => (
              <section key={group.key} className="card bg-base-100 overflow-hidden">
                <header className="border-base-300 flex items-center gap-2 border-b px-4 py-3">
                  <Heading level={2} className="text-base font-semibold">
                    {group.title}
                  </Heading>
                  <div className="flex-1" />
                  <Text className="text-sm">{groupPosts.length}</Text>
                </header>
                <ul>
                  {groupPosts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      onOpen={(event) => {
                        openPost(post, event);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <p className="shrink-0 px-1 text-xs">
        Click a post to open it · Shift-click to open alongside · Alt-click for a new window
      </p>
    </div>
  );
}

export default SocialQueueSurface;
