'use client';

// One conversation — the messages, who you are talking to, and the moves you can
// make on it.
//
// A PANE opened BESIDE the inbox, never a modal. It is a durable thing you return
// to and deep-link, comparing two conversations side by side is useful, and above
// all opening it must not cost the operator their view of the queue — the whole
// reason it docks alongside rather than taking over.
//
// Opening it clears the staff-unread flag (mark-read on mount), so arriving here
// is what marks the conversation read for the row in the inbox and the count on
// it. Live-ish without a socket: the detail query polls, so a reply typed by the
// visitor — or by a teammate in another window — appears within seconds.
//
// Deliberately NOT EditorLayout: there is no form with a summary rail here. One
// column — a compact "who is this" card, the messages, and the composer pinned at
// the bottom — which is what a chat actually is.

import { useEffect, useRef, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Badge,
  Button,
  Card,
  ChatTypingIndicator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Loading,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  faBan,
  faCircleCheck,
  faMessage,
  faPaperPlane,
  faRotate,
  faSparkles,
  faUserCheck,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useTeamRoster } from '../../lib/api/team';
import { useViewer, useSites } from '../../lib/api/shell-data';
import { describeAgo } from '../../lib/api/activity';
import { useReachableModules } from '../../lib/surfaces/use-visible-nav';
import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatDate as formatOrderDate,
  formatMoney as formatOrderMoney,
  shippingState,
  useOrders,
} from '../commerce/data';
import { targetFor } from '../commerce/orders-list-filters';
import { hasHistory, whoBadge, whoNote } from './who-line';
import {
  chatErrorMessage,
  conversationName,
  formatMessageTime,
  formatMoney,
  senderLabel,
  sourceLabel,
  statusLabel,
  statusTone,
  useConversation,
  useCustomerContext,
  useMarkRead,
  useQuickReplies,
  useSendMessage,
  useUpdateConversation,
  type ChatMessage,
  type ConversationDetail,
} from './data';
import { emitTyping, useChatLive, useTypingIndicator } from './live';

/* ── The "who you're talking to" card ─────────────────────────────────────── */

function ContextCard({
  conversation,
  siteName,
  ctx,
}: {
  conversation: ConversationDetail;
  siteName: string | null;
  ctx: SurfaceContext;
}) {
  const context = useCustomerContext(conversation.id);
  const reachable = useReachableModules();
  const name = conversationName(conversation);
  const data = context.data;
  // `null` while the module list loads, which every caller reads as "show
  // everything" rather than blanking the screen group by group.
  const sells = reachable === null || reachable.has('commerce');
  const match = data?.match ?? 'none';
  const badge = whoBadge(match);
  const note = whoNote(match, name, data?.name ?? null);

  return (
    <section className="card bg-base-100 flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Text as="span" className="text-base font-semibold">
          {name}
        </Text>
        {/* Three states, and the middle one is the point: the email the
            visitor typed matches somebody this shop knows, which is a strong
            hint and not proof. A colorless badge for the unknown state rather
            than `neutral`, which is not ours to choose. */}
        {badge.color === null ? (
          <Badge variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        ) : (
          <Badge color={badge.color} variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
        )}
      </div>

      {note !== null ? <Text className="text-sm">{note}</Text> : null}

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
        {(data?.email ?? conversation.customerEmail) ? (
          <span className="break-all">{data?.email ?? conversation.customerEmail}</span>
        ) : null}
        {data?.phone ? <span>{data.phone}</span> : null}
        {data?.company ? <span>{data.company}</span> : null}
        <span>
          {sourceLabel(conversation.source)}
          {siteName ? ` · ${siteName}` : ''}
        </span>
      </div>

      {/* Only somebody this shop knows has a spend history worth pulling up.
          An anonymous visitor's numbers would all be zero and say nothing.
          `hasHistory` is held against the badge by a test, so a history can
          never appear under a badge saying they have never been here. */}
      {hasHistory(match) && data ? (
        <div className="border-base-300 flex flex-wrap gap-x-6 gap-y-1 border-t pt-2 text-sm">
          <span>
            <span className="font-semibold tabular-nums">{data.orderCount}</span>{' '}
            {data.orderCount === 1 ? 'order' : 'orders'}
          </span>
          <span>
            <span className="font-semibold tabular-nums">{formatMoney(data.lifetimeValue)}</span>{' '}
            spent
          </span>
          {data.lastOrderAt ? <span>Last ordered {describeAgo(data.lastOrderAt)}</span> : null}
        </div>
      ) : null}

      {hasHistory(match) && data?.customerId != null && sells ? (
        <RecentOrders ctx={ctx} customerId={data.customerId} />
      ) : null}
    </section>
  );
}

/**
 * WHAT THEY BOUGHT, WHICH IS USUALLY WHAT THE CHAT IS ABOUT.
 *
 * The server used to send a thin five-field `recentOrders` array of its own for
 * this panel, and nothing ever drew it: a five-row query on every panel load
 * whose only reader threw it away (issue 864).
 * [[feedback_fetched_but_never_rendered]]
 *
 * Replaced rather than rendered, because that array could not say the one thing
 * a shopper is asking about. It carried the stored status word, and "fulfilled"
 * reads as finished to anybody who has not worked in commerce when it means the
 * opposite. So this reuses the Commerce order data layer whole instead, which is
 * the rule the CRM's own orders tab already follows: the delivery state reads in
 * the words `shippingState` was written to keep honest, a collection order does
 * not claim to be with a carrier, and a click opens the real order.
 */
function RecentOrders({ ctx, customerId }: { ctx: SurfaceContext; customerId: string }) {
  const { data, isPending, isError } = useOrders({
    customerId,
    // Canceled orders left out, because this list sits directly beneath the
    // lifetime figures and those do not count them either.
    countedOnly: true,
    sortBy: 'placedAt',
    order: 'desc',
    take: 3,
    skip: 0,
  });
  const rows = data?.items ?? [];

  if (isError) {
    return (
      <div className="border-base-300 border-t pt-2">
        <Text className="text-warning text-sm">Could not load their orders just now.</Text>
      </div>
    );
  }
  if (isPending || rows.length === 0) return null;

  return (
    // Selling's data, so the rows read as Selling: the Commerce hue on the badges.
    <ModuleScope module="commerce">
      <div className="border-base-300 flex flex-col gap-1 border-t pt-2">
        <Text as="span" className="text-sm font-semibold">
          {rows.length === 1 ? 'Their last order' : `Their last ${rows.length} orders`}
        </Text>
        <ul className="flex flex-col">
          {rows.map((row) => {
            const state = shippingState(row);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="hover:bg-base-200 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1.5 py-2 text-left"
                  onClick={(event) => {
                    ctx.open('commerce.order.detail', { id: row.id }, { target: targetFor(event) });
                  }}
                >
                  <span className="font-mono text-sm">{row.orderNumber}</span>
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                  <span className="text-sm">{formatOrderDate(row.placedAt)}</span>
                  <span className="ml-auto font-mono text-sm tabular-nums">
                    {formatOrderMoney(row.total, row.currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ModuleScope>
  );
}

/* ── One message ──────────────────────────────────────────────────────────── */

function MessageBubble({
  message,
  customerName,
  viewerId,
}: {
  message: ChatMessage;
  customerName: string | null;
  /** Who is reading, so their own reply says "You" rather than "Your team". */
  viewerId: string | null;
}) {
  const fromCustomer = message.senderType === 'customer';
  const isAi = message.senderType === 'ai' || message.aiGenerated;

  return (
    <li className={`flex flex-col ${fromCustomer ? 'items-start' : 'items-end'}`}>
      <div
        className={`flex max-w-[85%] flex-col gap-1 rounded-lg border px-3 py-2 ${
          fromCustomer ? 'border-base-300 bg-module bg-soft' : 'border-base-300 bg-base-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <Text as="span" className="text-sm font-semibold">
            {senderLabel(message, customerName, viewerId)}
          </Text>
          {isAi ? (
            <Badge color="info" variant="soft" size="sm">
              <Icon glyph={faSparkles} className="size-3" aria-hidden />
              AI
            </Badge>
          ) : null}
          <Text as="span" className="text-xs whitespace-nowrap">
            {formatMessageTime(message.createdAt)}
          </Text>
        </div>
        <p className="text-base whitespace-pre-wrap">{message.body}</p>
      </div>
    </li>
  );
}

/* ── The reply composer ───────────────────────────────────────────────────── */

function Composer({ id, disabled }: { id: string; disabled: boolean }) {
  const toast = useToast();
  const send = useSendMessage(id);
  const quickReplies = useQuickReplies();
  const [body, setBody] = useState('');

  // The typed-but-unsent reply is real work — closing or tearing off the pane
  // with it in the box should ask first.
  useDirtySource(
    body.trim() !== '' && !send.isPending,
    "You've typed a reply but haven't sent it. Close anyway?"
  );

  const submit = () => {
    const text = body.trim();
    if (text === '' || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => {
        setBody('');
      },
      onError: (error) => {
        // Deferred out of the mutation's commit — the same write invalidates the
        // thread this pane is showing, and a toast in that flush trips React.
        afterPaneChange(() => {
          toast.add({
            title: 'Could not send your reply',
            description: chatErrorMessage(error, 'Nothing was sent. Try again in a moment.'),
            type: 'error',
          });
        });
      },
    });
  };

  const insertQuickReply = (text: string) => {
    setBody((current) => (current.trim() === '' ? text : `${current.trimEnd()}\n\n${text}`));
  };

  return (
    <form
      className="border-base-300 bg-base-100 shrink-0 rounded-lg border p-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        value={body}
        rows={3}
        maxLength={8000}
        aria-label="Write a reply"
        placeholder={disabled ? 'This conversation is marked spam' : 'Write a reply…'}
        disabled={disabled}
        onChange={(event) => {
          setBody(event.target.value);
          // Let the visitor's widget show "Agent is typing" — throttled in live.ts.
          if (event.target.value.trim() !== '') emitTyping(id);
        }}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter is a new line — the chat convention.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button size="sm" variant="ghost" color="neutral" disabled={disabled}>
              <Icon glyph={faMessage} className="size-4" aria-hidden />
              Quick replies
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(quickReplies.data ?? []).length === 0 ? (
              <DropdownMenuItem disabled>
                No saved replies yet. Add them in Chat settings
              </DropdownMenuItem>
            ) : (
              (quickReplies.data ?? []).map((reply) => (
                <DropdownMenuItem
                  key={reply.id}
                  onClick={() => {
                    insertQuickReply(reply.body);
                  }}
                >
                  <span className="font-medium">{reply.title}</span>
                  {reply.shortcut ? (
                    <span className="ml-auto font-mono text-xs">/{reply.shortcut}</span>
                  ) : null}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Text as="span" className="hidden text-xs @md:inline">
          Enter to send · Shift+Enter for a new line
        </Text>

        <Button
          type="submit"
          color="module"
          size="sm"
          className="ml-auto"
          loading={send.isPending}
          disabled={disabled || body.trim() === ''}
        >
          <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
          Send
        </Button>
      </div>
    </form>
  );
}

/* ── The surface ──────────────────────────────────────────────────────────── */

export function ChatThreadSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const toast = useToast();
  const confirm = useConfirm();

  // Hold the socket open for this thread and join its room, so inbound messages,
  // status changes, and the visitor's typing arrive live rather than on a poll.
  useChatLive(id);
  const otherTyping = useTypingIndicator(id === '' ? undefined : id);

  const { data, error, isPending, isError, isFetching, dataUpdatedAt, refetch } =
    useConversation(id);
  const { data: sites } = useSites();
  const { members } = useTeamRoster();
  const { data: viewer } = useViewer();
  const update = useUpdateConversation(id);
  const markRead = useMarkRead(id);

  const scrollRef = useRef<HTMLOListElement | null>(null);
  const markedRef = useRef(false);
  const lastCountRef = useRef(0);

  const { setTitle } = ctx;
  useEffect(() => {
    if (data) setTitle(conversationName(data));
  }, [data, setTitle]);

  // Clear the unread flag once, when the thread first loads with unread inbound
  // messages. A ref rather than a dependency so a poll that re-reports the same
  // count doesn't fire a second write.
  useEffect(() => {
    if (!data || markedRef.current) return;
    markedRef.current = true;
    if (data.unreadStaff > 0) markRead.mutate();
  }, [data, markRead]);

  // Keep the newest message in view as they arrive — but only when the count
  // actually grew, so a background poll doesn't yank a scrolled-up reader down.
  useEffect(() => {
    const count = data?.messages.length ?? 0;
    if (count > lastCountRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = count;
  }, [data?.messages.length]);

  if (id === '') {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          reason="missing"
          title="No conversation to show"
          description="Open a conversation from the inbox to see it here."
        />
      </Card>
    );
  }

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading size="sm" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          {/* `error` and `noun`, so a conversation that is NOT THERE reads as
              gone rather than as a server that cannot be reached. Opening one
              that belongs to another business said "This is a problem reaching
              the server" over a Try again that will fail every time.
              [[feedback_one_outcome_two_causes]] */}
          <PaneLoadError
            title="Could not load this conversation"
            error={error}
            noun="conversation"
            description="This is a problem reaching the server. The conversation itself is unaffected."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  const siteName = data.propertyId
    ? (sites?.find((site) => site.id === data.propertyId)?.name ?? null)
    : null;
  const isResolved = data.status === 'resolved';
  const isSpam = data.status === 'spam';

  const assignItems: Record<string, string> = { '': 'Unassigned' };
  for (const member of members) {
    assignItems[member.userId] = member.name ?? member.email;
  }
  // A saved assignee who has since left the team still needs a label, or the
  // Select shows a blank current value.
  if (data.assignedToId && !assignItems[data.assignedToId]) {
    assignItems[data.assignedToId] = 'A former teammate';
  }

  const onAssign = (next: string) => {
    update.mutate(
      { assignedToId: next === '' ? null : next },
      {
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({
              title: 'Could not change who this is assigned to',
              description: chatErrorMessage(error, 'Nothing was changed.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  // The update invalidates the thread this pane is showing, so its refetch
  // re-renders here — the toast is deferred a macrotask out of that commit to
  // stay clear of React's flushSync guard.
  const setStatus = (status: 'open' | 'resolved' | 'spam', success: string, failure: string) => {
    update.mutate(
      { status },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({ title: success, type: 'success' });
          });
        },
        onError: (error) => {
          afterPaneChange(() => {
            toast.add({ title: failure, description: chatErrorMessage(error, ''), type: 'error' });
          });
        },
      }
    );
  };

  const onResolve = () => {
    setStatus('resolved', 'Marked as resolved', 'Could not resolve this conversation');
  };
  const onReopen = () => {
    setStatus('open', 'Reopened', 'Could not reopen this conversation');
  };

  const onMarkSpam = async () => {
    const ok = await confirm({
      title: 'Mark this conversation as spam?',
      description:
        'It moves out of your open queue into Spam, and its reply box is turned off. You can move it back later if it turns out to be genuine.',
      confirmLabel: 'Mark as spam',
      cancelLabel: 'Leave it',
      color: 'danger',
    });
    if (!ok) return;
    setStatus('spam', 'Moved to spam', 'Could not mark this as spam');
  };

  const onAssignToMe = () => {
    if (viewer?.userId) onAssign(viewer.userId);
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Conversation actions"
        /* VALUES rather than an ellipsis menu. The trigger was a nameless glyph,
           and it relocates into the overflow popover - where the hamburger
           beside it already means "the rest of the controls", so one menu
           opened another. As actions they arrive as labelled rows in the same
           place. scripts/check-toolbar-glyph.mjs holds the line. */
        actions={[
          ...(viewer?.userId && data.assignedToId !== viewer.userId
            ? [{ label: 'Assign to me', icon: faUserCheck, onClick: onAssignToMe }]
            : []),
          ...(isSpam
            ? []
            : [
                {
                  label: 'Mark as spam',
                  icon: faBan,
                  tone: 'danger' as const,
                  onClick: () => {
                    void onMarkSpam();
                  },
                },
              ]),
        ]}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      >
        <Badge color={statusTone(data.status)} variant="soft" size="sm">
          {statusLabel(data.status)}
        </Badge>

        <div className="flex-1" />

        {isResolved ? (
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            loading={update.isPending}
            onClick={onReopen}
          >
            <Icon glyph={faRotate} className="size-4" aria-hidden />
            Reopen
          </Button>
        ) : isSpam ? (
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            loading={update.isPending}
            onClick={onReopen}
          >
            <Icon glyph={faRotate} className="size-4" aria-hidden />
            Not spam
          </Button>
        ) : (
          <Button size="sm" color="module" loading={update.isPending} onClick={onResolve}>
            <Icon glyph={faCircleCheck} className="size-4" aria-hidden />
            Resolve
          </Button>
        )}
      </PaneToolbar>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <ContextCard conversation={data} siteName={siteName} ctx={ctx} />

        {/* Assigning lives here, beside the identity, rather than crowding the
            action bar — it is a property of the conversation, not a lifecycle
            move you make and move on from. */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Text as="span" className="text-sm font-medium">
            Assigned to
          </Text>
          <div className="min-w-40">
            <Select
              size="sm"
              color="module"
              aria-label="Who is handling this conversation"
              value={data.assignedToId ?? ''}
              items={assignItems}
              onValueChange={(next) => {
                onAssign(next as string);
              }}
            />
          </div>
        </div>

        <ol ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
          {data.messages.length === 0 ? (
            <li>
              <Text className="text-sm">
                No messages yet. Send the first one below to start the conversation.
              </Text>
            </li>
          ) : (
            data.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                customerName={data.customerName}
                viewerId={viewer?.userId ?? null}
              />
            ))
          )}
          {otherTyping ? (
            <li>
              <ChatTypingIndicator side="start" name={`${conversationName(data)} is typing`} />
            </li>
          ) : null}
        </ol>

        <Composer id={id} disabled={isSpam} />
      </div>
    </div>
  );
}
