'use client';

// Approvals — orders held for someone to say yes.
//
// The top half is the QUEUE: orders a trade account placed that went over a
// threshold, so checkout held them instead of placing them. Each waits for a
// yes or a no — approving places the order (and invoices it if they're on
// terms), rejecting cancels it. The bottom half is the RULES that decide when an
// order gets held: a spending limit, either across every account or on one.
//
// WHO SAYS YES (sparx persona issue 087). A limit is signed off either by your
// team or by the account's own approvers, the contacts whose role is "Can
// approve orders", on your site. A held order can wait on either side or both,
// and each row says which. An order only the account is asked about offers no
// Approve here, because it is not yours to approve and the server refuses it;
// Reject stays, because the business can always turn an order down.
//
// Approving and rejecting each take an optional reason, so they're a short modal
// — nothing to return to, over in seconds — rather than a bare confirm.
//
// WHAT APPROVING DID TO STOCK (sparx persona issue 087). Placing a held order
// takes its stock then. When the shelves were short, the customer is now owed
// goods, and that stays above the queue as a warning until it is dismissed: a
// toast that fades is not where a debt to a customer should be told. It opens
// the Waiting list, where owed stock is handled.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
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
  formatDay,
  queueBuyer,
  useAccountApproverChoices,
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
  ACCOUNT_APPROVERS,
  ANY_APPROVER,
  approverName,
  namableApprovers,
  signOffChoice,
  signOffValue,
} from '../../components/approver-choice';
import { useTeamRoster } from '../../lib/api/team';
import { ModuleScope } from '../../components/module-scope';
import { holdQueueNotice, holdReasonWords } from './approval-hold-notice';
import {
  accountApproversOption,
  approvedStockNotice,
  approveOutcome,
  approveWords,
  queueSignOffView,
  rejectWords,
  ruleSignOffNote,
  type ApprovedStockNotice,
  type DecisionFacts,
  type SignOffRule,
} from './sign-off-words';

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
  // Approvals this visit that left the customer owed goods, newest first. Kept
  // here, not in the dialog, because the dialog is gone the moment it succeeds.
  const [stockNotices, setStockNotices] = useState<ApprovedStockNotice[]>([]);

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
          {stockNotices.map((notice) => (
            <StockShortNotice
              key={notice.orderNumber}
              notice={notice}
              onOpenWaitingList={() => {
                ctx.open('inventory.backorders', {}, { target: 'beside' });
              }}
              onDismiss={() => {
                setStockNotices((all) =>
                  all.filter((one) => one.orderNumber !== notice.orderNumber)
                );
              }}
            />
          ))}
          <FormSection
            title="Waiting for sign-off"
            description="Orders held because they went over a limit. Each says who still has to approve it: your team, the approvers at the account, or both. Rejecting cancels it, whoever it waits on."
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

          <RulesSection ctx={ctx} />
        </div>
      </div>

      {decision ? (
        <DecisionDialog
          decision={decision}
          onDone={() => {
            setDecision(null);
          }}
          onStockShort={(notice) => {
            setStockNotices((all) => [
              notice,
              ...all.filter((one) => one.orderNumber !== notice.orderNumber),
            ]);
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
  // Who it waits on (sparx persona issue 087). An order only the account is
  // asked about is not this business's to approve, so Approve is not offered:
  // a button the server answers with a refusal is worse than none.
  const signOff = queueSignOffView(item.signOff, item.companyName, formatDay);
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
      {/* Why it is waiting: over a spending limit, over the account's credit,
          or both (sparx persona issue 085). Each asks a different question of
          the person signing, so each is said. */}
      {item.holdReasons.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {item.holdReasons.map((reason) => (
            <li key={reason.kind}>{holdReasonWords(reason, formatCents, item.currency)}</li>
          ))}
        </ul>
      ) : null}
      {signOff.badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {signOff.badges.map((badge) => (
            <Badge key={badge.label} color={badge.tone} variant="soft" size="sm">
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}
      {signOff.line ? <p>{signOff.line}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text as="span" className="text-sm">
          Placed {formatDateTime(item.createdAt)}
        </Text>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" color="danger" onClick={onReject}>
            Reject
          </Button>
          {signOff.canApprove ? (
            <Button size="sm" color="module" onClick={onApprove}>
              <CheckCircle className="size-4" aria-hidden />
              Approve
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** The facts both decision dialogs are worded from. */
function decisionFacts(item: QueueItem): DecisionFacts {
  return {
    orderNumber: item.orderNumber,
    buyer: queueBuyer(item),
    total: formatCents(item.totalCents, item.currency),
    companyName: item.companyName,
    signOff: item.signOff,
    overCreditLimit: item.holdReasons.some((reason) => reason.kind === 'over_credit_limit'),
  };
}

/* ── Decision dialog ────────────────────────────────────────────────────── */

/**
 * An approval that placed the order short of stock (sparx persona issue 087).
 * A warning, because the business now owes the customer goods, and it stays
 * until dismissed. The Waiting list is inventory's, so its button wears that
 * hue; it is offered only when this customer is owed something, since that is
 * all the Waiting list holds.
 */
function StockShortNotice({
  notice,
  onOpenWaitingList,
  onDismiss,
}: {
  notice: ApprovedStockNotice;
  onOpenWaitingList: () => void;
  onDismiss: () => void;
}) {
  return (
    <Alert color="warning" variant="soft" role="status">
      <AlertContent>
        <AlertTitle>{notice.title}</AlertTitle>
        <AlertDescription>{notice.detail}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
        {notice.owed ? (
          <ModuleScope module="inventory">
            <Button size="sm" color="module" onClick={onOpenWaitingList}>
              Open Waiting list
            </Button>
          </ModuleScope>
        ) : null}
      </AlertActions>
    </Alert>
  );
}

function DecisionDialog({
  decision,
  onDone,
  onStockShort,
}: {
  decision: NonNullable<Decision>;
  onDone: () => void;
  /** Placing it took stock the shelves did not have (sparx persona issue 087). */
  onStockShort: (notice: ApprovedStockNotice) => void;
}) {
  const toast = useToast();
  const approve = useApproveOrder();
  const reject = useRejectOrder();
  const [reason, setReason] = useState('');

  const isApprove = decision.action === 'approve';
  const pending = isApprove ? approve.isPending : reject.isPending;
  const { item } = decision;
  const facts = decisionFacts(item);

  const onError = (error: unknown) => {
    // The server's own sentence: a refusal names who the order is waiting
    // for, which is the one thing worth reading here.
    toast.add({
      title: isApprove ? 'Could not approve this order' : 'Could not reject this order',
      description: approvalErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const submit = () => {
    const input = { orderId: item.id, reason: reason.trim() === '' ? undefined : reason.trim() };
    if (isApprove) {
      approve.mutate(input, {
        onSuccess: (result) => {
          onDone();
          // Read what the server did, not what was asked: approving the
          // business's half of an order the account has yet to sign leaves it
          // waiting, and "placed" would be a promise about an order that has
          // not gone anywhere (sparx persona issue 087).
          const outcome = approveOutcome(result, item.signOff, item.companyName);
          afterPaneChange(() => {
            toast.add({ ...outcome, type: 'success' });
          });
          const short = approvedStockNotice(result, queueBuyer(item));
          if (short) onStockShort(short);
        },
        onError,
      });
      return;
    }
    reject.mutate(input, {
      onSuccess: () => {
        onDone();
        afterPaneChange(() => {
          toast.add({
            title: `Order ${item.orderNumber} rejected`,
            description: 'The order has been canceled.',
            type: 'success',
          });
        });
      },
      onError,
    });
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
          <DialogTitle>
            {!isApprove
              ? 'Reject this order?'
              : item.signOff.waitingOn.includes('account')
                ? 'Approve your side of this order?'
                : 'Approve this order?'}
          </DialogTitle>
          <DialogDescription>
            {isApprove ? approveWords(facts) : rejectWords(facts, formatDay)}
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
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              color={isApprove ? 'module' : 'danger'}
              size="sm"
              loading={pending}
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

function RulesSection({ ctx }: { ctx: SurfaceContext }) {
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

  // Who at the chosen account can approve, so the new limit's "their
  // approvers" choice can name them before it is saved (sparx persona issue
  // 087). The rules list only names them for limits that already exist.
  const chosenApprovers = useAccountApproverChoices(accountId);

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

  // The new limit, as the who-signs words read a saved one.
  const draftSigner: SignOffRule = {
    signOffBy: signOffChoice(approver).signOffBy,
    accountName:
      accountId === ''
        ? null
        : (accountItems.find((item) => item.value === accountId)?.label ?? 'This account'),
    accountApprovers: accountId === '' ? null : (chosenApprovers.data ?? null),
  };
  const draftNote = ruleSignOffNote(draftSigner);

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
        // Both halves, always: the server refuses the account signing beside a
        // named teammate, and a half left out would keep what it was.
        ...signOffChoice(approver),
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

  const openAccount = (id: string) => {
    ctx.open('b2b.account.detail', { id }, { target: 'beside' });
  };

  return (
    <FormSection
      title="When sign-off is needed"
      description="Hold any order over a set amount until someone says yes: your team, or the approvers at the account, on your site. Set it for every account, or just one."
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
            <Field className="@md:col-span-2">
              <FieldLabel>Who signs it off</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    className="max-w-full"
                    value={approver}
                    onChange={(event) => {
                      setApprover(event.target.value);
                    }}
                  >
                    <ApproverOptions
                      people={people}
                      accountOption={accountApproversOption(draftSigner)}
                    />
                  </NativeSelect>
                }
              />
              {draftNote === null ? (
                <FieldDescription>
                  {draftSigner.signOffBy === 'account'
                    ? 'The approvers at the account say yes on your site.'
                    : 'Naming one person means only they can approve or turn down an order this rule holds.'}
                </FieldDescription>
              ) : (
                <FieldDescription>{draftNote.text}</FieldDescription>
              )}
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
              onOpenAccount={openAccount}
              onApprover={(next) => {
                updateRule.mutate(
                  // Both halves, always (see onCreate).
                  { id: rule.id, ...signOffChoice(next) },
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
 * Your team first ("Anyone who can approve", then the team by name), then the
 * account's own approvers. A rule that names somebody no longer on the team
 * keeps them listed, so opening the screen does not quietly change who an order
 * waits for.
 *
 * Grouped, because "Anyone who can approve" and "Wasatch's approvers" answer
 * the same question from two different businesses, and the group labels say
 * which side of the counter each one stands on (sparx persona issue 087).
 */
function ApproverOptions({
  people,
  named,
  accountOption,
}: {
  people: ReturnType<typeof namableApprovers>;
  named?: { userId: string; name: string | null } | null;
  accountOption: string;
}) {
  const gone = named && !people.some((person) => person.userId === named.userId) ? named : null;
  return (
    <>
      <optgroup label="Your team">
        <option value={ANY_APPROVER}>Anyone who can approve</option>
        {people.map((person) => (
          <option key={person.userId} value={`user:${person.userId}`}>
            {approverName(person)}
          </option>
        ))}
        {gone ? (
          <option value={`user:${gone.userId}`}>{gone.name ?? 'The person this rule names'}</option>
        ) : null}
      </optgroup>
      <optgroup label="The account">
        <option value={ACCOUNT_APPROVERS}>{accountOption}</option>
      </optgroup>
    </>
  );
}

function RuleRow({
  rule,
  people,
  onApprover,
  onOpenAccount,
  busy,
  onToggle,
  onDelete,
}: {
  rule: ApprovalRule;
  busy: boolean;
  people: ReturnType<typeof namableApprovers>;
  onApprover: (next: string) => void;
  onOpenAccount: (accountId: string) => void;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  const note = ruleSignOffNote(rule);
  return (
    // Two lines, not one wrapping strip. The who-signs select is as wide as its
    // longest option, and "Wasatch Front Utility Contractors, LLC's approvers
    // (Teodora Vukić-Hale)" squeezed the account name beside it to one word a
    // line and pushed the switch and bin onto a line of their own. So what the
    // limit IS and its on/off controls share the top line, and the select sits
    // under them at a capped width, where a long option truncates inside the
    // closed control; the note below the row says it in full (sparx persona
    // issue 087).
    <li className="border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 break-words">
          <span className="block font-medium">Over {rule.minAmountFormatted}</span>
          <Text as="span" className="block text-sm">
            {rule.accountName ?? 'Every account'}
          </Text>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {/* State on both sides of the switch: a rule that is holding orders
              says so as plainly as one that is not, and neither is gray. */}
          <Badge color={rule.isActive ? 'success' : 'warning'} variant="soft" size="sm">
            {rule.isActive ? 'On' : 'Off'}
          </Badge>
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
        </div>
      </div>
      <NativeSelect
        color="module"
        size="sm"
        className="w-full max-w-md"
        value={signOffValue(rule)}
        disabled={busy}
        aria-label={`Who signs off orders over ${rule.minAmountFormatted}`}
        onChange={(event) => {
          onApprover(event.target.value);
        }}
      >
        <ApproverOptions
          people={people}
          accountOption={accountApproversOption(rule)}
          named={
            rule.requiredApproverUserId
              ? { userId: rule.requiredApproverUserId, name: rule.requiredApproverName }
              : null
          }
        />
      </NativeSelect>
      {/* Who actually signs, when it is the account. A limit set to an account
          with nobody who can approve still holds orders, but your team signs
          them, and the row says so with the way to change it rather than let
          the option's name imply the account is signing. */}
      {note === null ? null : note.tone === 'warning' && rule.accountId ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertDescription>{note.text}</AlertDescription>
          </AlertContent>
          <AlertActions>
            <Button
              size="sm"
              color="warning"
              onClick={() => {
                if (rule.accountId) onOpenAccount(rule.accountId);
              }}
            >
              Open the account
            </Button>
          </AlertActions>
        </Alert>
      ) : (
        <p>{note.text}</p>
      )}
    </li>
  );
}
