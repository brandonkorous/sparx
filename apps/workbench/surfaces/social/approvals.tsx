'use client';

// Approvals — the inbox of posts waiting for an admin's sign-off before they can
// go live. Anything a teammate submitted, or an automation drafted, parks here.
//
// This is a pane, not a modal: it is a durable queue you return to, and each
// decision (approve → it schedules or publishes; reject → back to the author as a
// draft) is a real state change on the server, not throwaway work. Rejecting is
// behind a confirm that names the post.

import { useEffect, useMemo } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  Heading,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { CheckCheck, Inbox, ServerCrash, X } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useViewer } from '../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  canApprove,
  socialErrorMessage,
  useApprovePost,
  useRejectPost,
  useSocialPosts,
  type Post,
} from './data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function excerpt(body: string): string {
  const first = body.trim().split('\n')[0] ?? '';
  return first.length > 160 ? `${first.slice(0, 157)}…` : first || 'Untitled post';
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ── One post awaiting review ─────────────────────────────────────────────── */

function ApprovalCard({
  post,
  canDecide,
  onOpen,
}: {
  post: Post;
  canDecide: boolean;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const approve = useApprovePost(post.id);
  const reject = useRejectPost(post.id);

  const goesLiveNow = !post.scheduledAt;

  const onApprove = () => {
    approve.mutate(undefined, {
      onSuccess: (updated) => {
        toast.add({
          title: updated.status === 'scheduled' ? 'Approved and scheduled' : 'Approved — going out',
          description:
            updated.status === 'scheduled' && updated.scheduledAt
              ? `It will post ${formatWhen(updated.scheduledAt)}.`
              : 'It is being sent to your accounts now.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not approve this post',
          description: socialErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onReject = () => {
    void (async () => {
      const ok = await confirm({
        title: 'Send this post back?',
        description: `“${excerpt(post.body)}” goes back to the author as a draft so they can change it and submit it again. Nothing is posted.`,
        confirmLabel: 'Send it back',
        cancelLabel: 'Keep reviewing',
        color: 'danger',
      });
      if (!ok) return;
      reject.mutate(undefined, {
        onSuccess: () => {
          toast.add({ title: 'Sent back to the author', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not send this post back',
            description: socialErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
    })();
  };

  const busy = approve.isPending || reject.isPending;

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
      <button
        type="button"
        className="hover:bg-base-200 -m-1 flex cursor-pointer flex-col gap-1 rounded p-1 text-left"
        onClick={onOpen}
      >
        <Text className="text-base font-medium break-words">{excerpt(post.body)}</Text>
        <Text className="text-sm">
          {post.scheduledAt
            ? `Scheduled for ${formatWhen(post.scheduledAt)}`
            : 'No time set — approving posts it now'}{' '}
          ·{' '}
          {post.targets.length === 1
            ? '1 destination'
            : `${String(post.targets.length)} destinations`}
        </Text>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        {post.targets.map((target) => (
          <Badge key={target.id} color="neutral" variant="soft" size="sm">
            {target.targetName}
          </Badge>
        ))}
      </div>

      {canDecide ? (
        <div className="border-base-300 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            color="module"
            loading={approve.isPending}
            disabled={busy}
            onClick={onApprove}
          >
            <CheckCheck className="size-4" aria-hidden />
            {goesLiveNow ? 'Approve & post now' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="danger"
            loading={reject.isPending}
            disabled={busy}
            onClick={onReject}
          >
            <X className="size-4" aria-hidden />
            Send back
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── The surface ──────────────────────────────────────────────────────────── */

export function SocialApprovalsSurface({ ctx }: { ctx: SurfaceContext }) {
  const viewer = useViewer();
  const posts = useSocialPosts('pending_approval');

  const canDecide = canApprove(viewer.data?.role);
  const pending = useMemo(() => posts.data ?? [], [posts.data]);

  useEffect(() => {
    ctx.setTitle('Approvals');
  }, [ctx]);

  const openPost = (post: Post, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('social.composer', { id: post.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Approvals controls">
        <Inbox className="size-4 shrink-0" aria-hidden />
        <Heading level={2} className="min-w-0 truncate text-base font-semibold">
          Approvals
        </Heading>
        {pending.length > 0 ? (
          <Badge color="warning" variant="soft" size="sm">
            {pending.length === 1 ? '1 waiting' : `${String(pending.length)} waiting`}
          </Badge>
        ) : null}
        <RefreshButton
          className="ml-auto"
          isFetching={posts.isFetching}
          updatedAt={posts.data ? posts.dataUpdatedAt : undefined}
          onRefresh={() => {
            void posts.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {posts.isError ? (
            <EmptyState
              icon={<ServerCrash className="size-6" aria-hidden />}
              title="Could not load the approvals inbox"
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
          ) : posts.isPending ? (
            <p className="text-sm" role="status">
              Loading…
            </p>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" aria-hidden />}
              title="Nothing waiting for approval"
              description="When a teammate submits a post, or an automation drafts one, it lands here for an admin to approve before it goes live."
            />
          ) : (
            <>
              {!canDecide ? (
                <Alert color="info" variant="soft">
                  <AlertContent>
                    <AlertTitle>Only an admin can approve</AlertTitle>
                    <AlertDescription>
                      You can see what is waiting, but approving or sending a post back is an
                      admin&rsquo;s job.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}
              <section className="flex flex-col gap-3">
                {pending.map((post) => (
                  <ApprovalCard
                    key={post.id}
                    post={post}
                    canDecide={canDecide}
                    onOpen={(event) => {
                      openPost(post, event);
                    }}
                  />
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SocialApprovalsSurface;
