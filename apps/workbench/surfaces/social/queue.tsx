'use client';

// Posts — the list workspace: everything drafted, scheduled, and sent, grouped by where
// it is in its life (needs a look → scheduled → drafts → posted), each row led by its
// picture and the accounts it lands on. This is the search-and-triage lens; the Calendar
// (its own top-level panel, and the module's landing) is the day-to-day one. A switch in
// the toolbar hops between them.
//
// A pipeline strip across the top is both the glance (how much is where) and the filter
// (tap a stage to see just those).

import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Heading, SearchInput, Text } from '@wizeworks/silicaui-react';
import { ExternalLink, Plus, Send, ServerCrash } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { MediaAsset } from '../cms/media';
import { postStatusMeta, socialErrorMessage, type CatalogEntry, type Post } from './data';
import { DestinationAvatars, PostThumb, excerpt, whenLine } from './post-visuals';
import { GROUPS, useSocialBoard } from './board';

/* ── One post, as a list row ──────────────────────────────────────────────── */

function PostRow({
  post,
  assetsById,
  avatarByTargetId,
  catalogMap,
  onOpen,
}: {
  post: Post;
  assetsById: Map<string, MediaAsset>;
  avatarByTargetId: Map<string, string | null>;
  catalogMap: Map<string, CatalogEntry>;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const meta = postStatusMeta(post.status);
  const withLinks = post.targets.filter((t) => t.permalink);

  return (
    <li className="border-base-300 flex flex-col border-b last:border-b-0">
      <button
        type="button"
        className="hover:bg-base-200 flex w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <PostThumb post={post} assetsById={assetsById} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-start gap-3">
            <span className="min-w-0 flex-1 text-base font-medium break-words">
              {excerpt(post.body)}
            </span>
            <Badge color={meta.tone} variant="soft" size="sm">
              {meta.label}
            </Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-sm">{whenLine(post)}</Text>
            {post.targets.length > 0 ? (
              <>
                <span className="text-sm" aria-hidden>
                  ·
                </span>
                <DestinationAvatars
                  targets={post.targets}
                  avatarByTargetId={avatarByTargetId}
                  catalogMap={catalogMap}
                />
              </>
            ) : null}
          </span>
        </span>
      </button>

      {/* Live links — a sibling of the row button, since an anchor cannot nest in one. */}
      {withLinks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 pl-20">
          {withLinks.map((target) => (
            <a
              key={target.id}
              href={target.permalink ?? undefined}
              target="_blank"
              rel="noreferrer noopener"
              className="text-module inline-flex items-center gap-0.5 text-sm underline"
            >
              View on {target.targetName}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/* ── Pipeline overview strip (glance + filter) ────────────────────────────── */

function PipelineStrip({
  counts,
  activeFilter,
  onPick,
}: {
  counts: Record<string, number>;
  activeFilter: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
      {GROUPS.map((group) => {
        const count = counts[group.key] ?? 0;
        const active = activeFilter === group.key;
        // "Needs a look" earns a warning number when it is non-empty — the one stage
        // that wants attention. The rest carry their weight in scale, not colour.
        const emphatic = group.key === 'review' && count > 0;
        return (
          <button
            key={group.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onPick(group.key);
            }}
            className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors ${
              active
                ? 'border-module bg-module bg-soft'
                : 'border-base-300 hover:border-module bg-base-100'
            }`}
          >
            <span
              className={`text-2xl font-semibold tabular-nums ${emphatic ? 'text-warning' : ''}`}
            >
              {count}
            </span>
            <span className="text-sm">{group.title}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── The surface ──────────────────────────────────────────────────────────── */

export function SocialQueueSurface({ ctx }: { ctx: SurfaceContext }) {
  const board = useSocialBoard(ctx);
  const { posts, canWrite, all, assetsById, avatarByTargetId, catalogMap, counts } = board;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const needle = search.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? all.filter((post) => post.body.toLowerCase().includes(needle)) : all),
    [all, needle]
  );

  const grouped = useMemo(() => {
    return GROUPS.filter((group) => !filter || group.key === filter)
      .map((group) => ({
        group,
        posts: matches.filter((post) => group.statuses.includes(post.status)),
      }))
      .filter((section) => section.posts.length > 0);
  }, [matches, filter]);

  const pickFilter = (key: string) => {
    setFilter((current) => (current === key ? null : key));
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
      <PaneToolbar label="Posts list controls" wrap>
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search posts"
            placeholder="Search posts…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        {canWrite ? (
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0 whitespace-nowrap"
            title="Write a new post — hold Shift to open alongside, Alt for a new window"
            onClick={(event) => {
              board.openNew(event);
            }}
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
        ) : all.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={<Send className="size-6" aria-hidden />}
              title="No posts yet"
              description="Write a post once and send it to every account you have connected. Drafts, scheduled posts and everything you have already sent will show up here."
              actions={
                canWrite ? (
                  <Button
                    color="module"
                    size="sm"
                    onClick={(event) => {
                      board.openNew(event);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    New post
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
            <PipelineStrip counts={counts} activeFilter={filter} onPick={pickFilter} />

            {matches.length === 0 ? (
              <EmptyState
                icon={<Send className="size-6" aria-hidden />}
                title="No posts match that"
                description="Try different words, or clear the search to see them all."
              />
            ) : grouped.length === 0 ? (
              <EmptyState
                icon={<Send className="size-6" aria-hidden />}
                title="Nothing in this stage"
                description="No posts are at this stage right now. Tap the stage again to see everything."
              />
            ) : (
              grouped.map(({ group, posts: groupPosts }) => (
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
                        assetsById={assetsById}
                        avatarByTargetId={avatarByTargetId}
                        catalogMap={catalogMap}
                        onOpen={(event) => {
                          board.openPost(post, event);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
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
