'use client';

// Approvals — orders held for someone to say yes.
//
// The top half is the QUEUE: orders a trade account placed that went over a
// threshold, so checkout held them instead of placing them. Each waits for a
// yes or a no — approving places the order (and invoices it if they're on
// terms), rejecting cancels it. The bottom half is the RULES that decide when an
// order gets held: a spending limit, either across every account or on one.
//
// Approving and rejecting each take an optional reason, so they're a short modal
// — nothing to return to, over in seconds — rather than a bare confirm.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NativeSelect,
  SearchInput,
  Select,
  Switch,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';
import { afterPaneChange } from '../../lib/defer';
import { useConfirm } from '../../lib/confirm';
import { PaneScope } from '../../lib/dock/window-boundary';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { MoneyInput } from '@/components/money-input';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  approvalErrorMessage,
  formatCents,
  formatDateTime,
  queueBuyer,
  useApprovalAccountChoices,
  useApprovalQueue,
  useApprovalRules,
  useApproveOrder,
  useCreateRule,
  useDeleteRule,
  useRejectOrder,
  useUpdateRule,
  type ApprovalRule,
  type QueueItem,
} from './approvals-data';
import {
  ANY_APPROVER,
  approverChoice,
  approverName,
  approverValue,
  namableApprovers,
} from '../../components/approver-choice';
import { useTeamRoster } from '../../lib/api/team';
import { holdQueueNotice } from './approval-hold-notice';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type Decision = { item: QueueItem; action: 'approve' | 'reject' } | null;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function ApprovalsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<Decision>(null);

  const queue = useApprovalQueue(search.trim());
  const items = queue.data?.items ?? [];

  // The rules the section below owns, read here too so the empty queue can say
  // what it actually means. Same query key, so this costs no extra request —
  // and an empty queue whose limits are all switched off has to say so rather
  // than promise that orders will be held (`approval-hold-notice.ts`).
  const rules = useApprovalRules().data ?? [];
  const emptyQueue = holdQueueNotice(rules);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Approvals controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search held orders"
              placeholder="Order number or company…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        refresh={
          <RefreshButton
            isFetching={queue.isFetching}
            updatedAt={queue.data ? queue.dataUpdatedAt : undefined}
            onRefresh={() => {
              void queue.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <FormSection
            title="Waiting for sign-off"
            description="Orders held because they went over a limit. Approve to place them, or reject to cancel."
          >
            {queue.isError ? (
              <Text className="text-sm">
                The queue could not be loaded just now. Your orders are unaffected.
              </Text>
            ) : queue.isPending ? (
              <Text className="text-sm" role="status">
                Loading…
              </Text>
            ) : items.length === 0 ? (
              <div className="py-2">
                <EmptyState
                  icon={<CheckCircle className="size-6" aria-hidden />}
                  title={search.trim() ? 'Nothing matches that' : emptyQueue.title}
                  description={
                    search.trim()
                      ? 'No held order matches that. Clear the search to see the whole queue.'
                      : emptyQueue.detail
                  }
                />
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    onOpen={(event) => {
                      ctx.open(
                        'commerce.order.detail',
                        { id: item.id },
                        { target: targetFor(event) }
                      );
                    }}
                    onApprove={() => {
                      setDecision({ item, action: 'approve' });
                    }}
                    onReject={() => {
                      setDecision({ item, action: 'reject' });
                    }}
                  />
                ))}
              </ul>
            )}
          </FormSection>

          <RulesSection />
        </div>
      </div>

      {decision ? (
        <DecisionDialog
          decision={decision}
          onDone={() => {
            setDecision(null);
          }}
        />
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  onOpen,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <button
          type="button"
          className="link link-hover font-mono text-sm"
          onClick={(event) => {
            onOpen(event);
          }}
        >
          {item.orderNumber}
        </button>
        <span className="min-w-0 flex-1 font-medium">{queueBuyer(item)}</span>
        <Text as="span" className="font-semibold tabular-nums">
          {formatCents(item.totalCents, item.currency)}
        </Text>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text as="span" className="text-sm">
          Placed {formatDateTime(item.createdAt)}
        </Text>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" color="danger" onClick={onReject}>
            Reject
          </Button>
          <Button size="sm" color="module" onClick={onApprove}>
            <CheckCircle className="size-4" aria-hidden />
            Approve
          </Button>
        </div>
      </div>
    </li>
  );
}

/* ── Decision dialog ────────────────────────────────────────────────────── */

function DecisionDialog({
  decision,
  onDone,
}: {
  decision: NonNullable<Decision>;
  onDone: () => void;
}) {
  const toast = useToast();
  const approve = useApproveOrder();
  const reject = useRejectOrder();
  const [reason, setReason] = useState('');

  const isApprove = decision.action === 'approve';
  const mutation = isApprove ? approve : reject;
  const buyer = queueBuyer(decision.item);

  const submit = () => {
    mutation.mutate(
      { orderId: decision.item.id, reason: reason.trim() === '' ? undefined : reason.trim() },
      {
        onSuccess: () => {
          onDone();
          afterPaneChange(() => {
            toast.add({
              title: isApprove
                ? `Order ${decision.item.orderNumber} approved`
                : `Order ${decision.item.orderNumber} rejected`,
              description: isApprove ? 'The order is placed.' : 'The order has been canceled.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: isApprove ? 'Could not approve this order' : 'Could not reject this order',
            description: approvalErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onDone();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{isApprove ? 'Approve this order?' : 'Reject this order?'}</DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Order ${decision.item.orderNumber} from ${buyer}, for ${formatCents(decision.item.totalCents, decision.item.currency)}, will be placed${''}. If they're on terms, it will be invoiced.`
              : `Order ${decision.item.orderNumber} from ${buyer}, for ${formatCents(decision.item.totalCents, decision.item.currency)}, will be canceled. This can't be undone.`}
          </DialogDescription>

          <div className="py-2">
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={reason}
                    placeholder={
                      isApprove
                        ? 'Optional: noted against the order.'
                        : 'Optional: why it was turned down.'
                    }
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>Kept on the order&apos;s history.</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose>
              <Button color="neutral" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              color={isApprove ? 'module' : 'danger'}
              size="sm"
              loading={mutation.isPending}
              onClick={submit}
            >
              {isApprove ? 'Approve order' : 'Reject order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

function RulesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const rulesQuery = useApprovalRules();
  const accountsQuery = useApprovalAccountChoices();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [accountId, setAccountId] = useState('');
  const [approver, setApprover] = useState(ANY_APPROVER);

  // Only people already in the account can be named. An invitation nobody has
  // answered has no login behind it, and naming it would hold every order the
  // rule catches with nobody able to release them. The server refuses it too.
  const roster = useTeamRoster();
  const people = useMemo(() => namableApprovers(roster.members), [roster.members]);

  const rules = rulesQuery.data ?? [];

  const accountItems = useMemo(
    () => [
      { value: '', label: 'Every account' },
      ...(accountsQuery.data?.items ?? []).map((account) => ({
        value: account.id,
        label: account.companyName,
      })),
    ],
    [accountsQuery.data]
  );

  /**
   * Removing a limit is the one action here that cannot be undone, and the
   * control for it is a small icon a thumb-width from the on/off switch. What
   * it takes away is the thing holding big orders back, so it says what stops
   * happening rather than only asking twice. [[feedback_destructive_actions_confirm]]
   */
  const removeRule = async (rule: ApprovalRule) => {
    const ok = await confirm({
      title: `Remove the limit over ${rule.minAmountFormatted}?`,
      description:
        rule.accountName === null
          ? 'No order will be held for sign-off on size alone. Every trade order goes straight ' +
            'through, however large.'
          : `No order from ${rule.accountName} will be held for sign-off again, however large.`,
      confirmLabel: 'Remove the limit',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    deleteRule.mutate(rule.id, {
      onSuccess: () => {
        toast.add({ title: 'Limit removed', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove that limit',
          description: approvalErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onCreate = () => {
    createRule.mutate(
      {
        accountId: accountId === '' ? null : accountId,
        minAmountCents: Math.round(amount * 100),
        requiredApproverUserId: approverChoice(approver).requiredApproverUserId,
      },
      {
        onSuccess: () => {
          setAdding(false);
          setAmount(1000);
          setAccountId('');
          setApprover(ANY_APPROVER);
          toast.add({ title: 'Rule added', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that rule',
            description: approvalErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <FormSection
      title="When sign-off is needed"
      description="Hold any order over a set amount for approval: across every account, or just one."
      action={
        !adding ? (
          <Button
            size="sm"
            variant="soft"
            color="module"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add a rule
          </Button>
        ) : null
      }
    >
      {adding ? (
        <div className="border-base-300 flex flex-col gap-3 rounded border p-3">
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Field>
              <FieldLabel>Hold orders over</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-40">
                    <MoneyInput
                      color="module"
                      value={amount}
                      aria-label="Threshold amount"
                      onValueChange={setAmount}
                    />
                  </div>
                }
              />
            </Field>
            <Field>
              <FieldLabel>For which account</FieldLabel>
              <FieldControl
                render={
                  <Select
                    color="module"
                    aria-label="Which account this applies to"
                    value={accountId}
                    items={accountItems}
                    onValueChange={(next) => {
                      setAccountId((next as string | null) ?? '');
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Who signs it off</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    value={approver}
                    onChange={(event) => {
                      setApprover(event.target.value);
                    }}
                  >
                    <ApproverOptions people={people} />
                  </NativeSelect>
                }
              />
              <FieldDescription>
                Naming one person means only they can approve or turn down an order this rule holds.
              </FieldDescription>
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              color="module"
              disabled={amount <= 0}
              loading={createRule.isPending}
              onClick={onCreate}
            >
              Add rule
            </Button>
            <Button
              size="sm"
              variant="ghost"
              color="neutral"
              onClick={() => {
                setAdding(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {rulesQuery.isError ? (
        <Text className="text-sm">The rules could not be loaded just now.</Text>
      ) : rulesQuery.isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : rules.length === 0 ? (
        !adding ? (
          <Text className="text-sm">
            No rules yet, so no orders are held. Everything a trade account places goes straight
            through. Add a rule to hold big orders for sign-off.
          </Text>
        ) : null
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              people={people}
              busy={updateRule.isPending || deleteRule.isPending}
              onApprover={(next) => {
                updateRule.mutate(
                  {
                    id: rule.id,
                    requiredApproverUserId: approverChoice(next).requiredApproverUserId,
                  },
                  {
                    onError: (error) => {
                      toast.add({
                        title: 'Could not change who signs this off',
                        description: approvalErrorMessage(
                          error,
                          'The rule is unchanged, so the same person signs it off as before.'
                        ),
                        type: 'error',
                      });
                    },
                  }
                );
              }}
              onToggle={(next) => {
                // A switch that springs back and says nothing is the same
                // screen as a switch that never moved. The list is only
                // invalidated on success, so a failure reverts it silently.
                updateRule.mutate(
                  { id: rule.id, isActive: next },
                  {
                    onError: (error) => {
                      toast.add({
                        title: next
                          ? 'Could not switch that limit on'
                          : 'Could not switch that limit off',
                        description: approvalErrorMessage(
                          error,
                          'The limit is unchanged, so orders are still being held the way they were.'
                        ),
                        type: 'error',
                      });
                    },
                  }
                );
              }}
              onDelete={() => {
                void removeRule(rule);
              }}
            />
          ))}
        </ul>
      )}
    </FormSection>
  );
}

/**
 * "Anyone who can approve", then the team by name. A rule that names somebody
 * no longer on the team keeps them listed, so opening the screen does not
 * quietly change who an order waits for.
 */
function ApproverOptions({
  people,
  named,
}: {
  people: ReturnType<typeof namableApprovers>;
  named?: { userId: string; name: string | null } | null;
}) {
  const gone = named && !people.some((person) => person.userId === named.userId) ? named : null;
  return (
    <>
      <option value={ANY_APPROVER}>Anyone who can approve</option>
      {people.map((person) => (
        <option key={person.userId} value={`user:${person.userId}`}>
          {approverName(person)}
        </option>
      ))}
      {gone ? (
        <option value={`user:${gone.userId}`}>{gone.name ?? 'The person this rule names'}</option>
      ) : null}
    </>
  );
}

function RuleRow({
  rule,
  people,
  onApprover,
  busy,
  onToggle,
  onDelete,
}: {
  rule: ApprovalRule;
  busy: boolean;
  people: ReturnType<typeof namableApprovers>;
  onApprover: (next: string) => void;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <li className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Over {rule.minAmountFormatted}</span>
        <Text as="span" className="block text-sm">
          {rule.accountName ?? 'Every account'}
        </Text>
      </span>
      <NativeSelect
        color="module"
        size="sm"
        className="w-auto"
        value={approverValue(rule)}
        disabled={busy}
        aria-label={`Who signs off orders over ${rule.minAmountFormatted}`}
        onChange={(event) => {
          onApprover(event.target.value);
        }}
      >
        <ApproverOptions
          people={people}
          named={
            rule.requiredApproverUserId
              ? { userId: rule.requiredApproverUserId, name: rule.requiredApproverName }
              : null
          }
        />
      </NativeSelect>
      {!rule.isActive ? (
        <Badge color="neutral" variant="soft" size="sm">
          Off
        </Badge>
      ) : null}
      <Switch
        color="module"
        checked={rule.isActive}
        disabled={busy}
        aria-label={`Turn this rule ${rule.isActive ? 'off' : 'on'}`}
        onCheckedChange={onToggle}
      />
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        disabled={busy}
        aria-label="Remove this rule"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
