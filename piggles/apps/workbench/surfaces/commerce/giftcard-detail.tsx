'use client';

// One gift card — issue it, then manage it.
//
// Issuing and managing are the same surface in two states. `{ id: 'new' }` is the
// ISSUE form: an amount, who it is for, an optional message. `{ id }` is the
// MANAGE view: the code, the balance and the full ledger — none of it editable,
// because a gift card is money. The only way its balance moves by hand is an
// ADJUSTMENT, which is a recorded, reasoned transaction, not a field you type
// over. That distinction is the whole point of the screen.

import { useEffect, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faMinus, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents } from './products-data';
import {
  giftCardErrorMessage,
  giftCardState,
  transactionMeaning,
  useAdjustGiftCard,
  useGiftCard,
  useIssueGiftCard,
  type GiftCardDetail,
} from './giftcards-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const CURRENCIES = {
  USD: 'US dollars',
  EUR: 'Euros',
  GBP: 'British pounds',
  CAD: 'Canadian dollars',
  AUD: 'Australian dollars',
};

function dollarsToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function GiftCardDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <IssueGiftCard ctx={ctx} /> : <ManageGiftCard ctx={ctx} id={id} />;
}

/* ── Issue (new) ────────────────────────────────────────────────────────── */

function IssueGiftCard({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const issue = useIssueGiftCard();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [expiry, setExpiry] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    ctx.setTitle('New gift card');
  }, [ctx]);

  const amountCents = dollarsToCents(amount);
  const amountError =
    amountCents === undefined || amountCents <= 0 ? 'Enter how much to load onto the card.' : null;

  const dirty =
    amount.trim() !== '' ||
    recipientName.trim() !== '' ||
    recipientEmail.trim() !== '' ||
    message.trim() !== '' ||
    expiry.trim() !== '';

  useDirtySource(
    dirty && !issue.isSuccess,
    'This gift card has not been issued yet. Close anyway?'
  );

  const failure = issue.isError
    ? giftCardErrorMessage(issue.error, 'Could not issue this gift card. Nothing was created.')
    : null;

  const submit = () => {
    setTouched(true);
    if (amountError || amountCents === undefined) return;
    issue.mutate(
      {
        initialBalanceCents: amountCents,
        currency,
        ...(recipientName.trim() ? { recipientName: recipientName.trim() } : {}),
        ...(recipientEmail.trim() ? { recipientEmail: recipientEmail.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(expiry.trim() ? { expiresAt: new Date(expiry).toISOString() } : {}),
      },
      {
        onSuccess: (created) => {
          ctx.open('commerce.giftcard.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `Gift card ${created.code} issued`, type: 'success' });
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Gift card actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={issue.isPending}
            disabled={Boolean(amountError)}
            onClick={submit}
          >
            Issue gift card
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>
            Load an amount onto a new card and, if you like, say who it is for. A unique code is
            created for you — share it with the recipient so they can spend it at checkout.
          </Text>

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not issue this gift card</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="Amount">
            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Load this much</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex items-center gap-2">
                      <Text as="span" className="text-lg">
                        $
                      </Text>
                      <Input
                        color={amountError && touched ? 'error' : 'module'}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={amount}
                        placeholder="50.00"
                        onChange={(event) => {
                          setAmount(event.target.value);
                        }}
                      />
                    </div>
                  }
                />
                {amountError && touched ? (
                  <FieldStatus status="error">{amountError}</FieldStatus>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select
                  color="module"
                  aria-label="Currency"
                  value={currency}
                  items={CURRENCIES}
                  onValueChange={(next) => {
                    setCurrency(next as string);
                  }}
                />
                <FieldDescription>
                  A card can only be spent on orders in the same currency.
                </FieldDescription>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Who it is for (optional)"
            description="For your records, and to address the card if you email it."
          >
            <Field>
              <FieldLabel>Recipient name</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={recipientName}
                    placeholder="Alex Morgan"
                    onChange={(event) => {
                      setRecipientName(event.target.value);
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Recipient email</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    type="email"
                    value={recipientEmail}
                    placeholder="alex@example.com"
                    onChange={(event) => {
                      setRecipientEmail(event.target.value);
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Message</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={message}
                    placeholder="Happy birthday!"
                    onChange={(event) => {
                      setMessage(event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>

          <FormSection
            title="Expiry (optional)"
            description="Leave empty for a card that never expires."
          >
            <Field>
              <FieldLabel>Expires on</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-[16rem]">
                    <Input
                      color="module"
                      type="date"
                      value={expiry}
                      onChange={(event) => {
                        setExpiry(event.target.value);
                      }}
                    />
                  </div>
                }
              />
            </Field>
          </FormSection>
        </div>
      </div>
    </div>
  );
}

/* ── Manage (existing) ──────────────────────────────────────────────────── */

function ManageGiftCard({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: card, isPending, isError, isFetching, dataUpdatedAt, refetch } = useGiftCard(id);

  useEffect(() => {
    ctx.setTitle(card ? `Gift card ${card.code}` : 'Gift card');
  }, [ctx, card]);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Gift card actions"
        status={
          card ? (
            <Badge color={giftCardState(card.status).tone} variant="soft" size="sm">
              {giftCardState(card.status).label}
            </Badge>
          ) : null
        }
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={card ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isError ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not load this gift card</AlertTitle>
                <AlertDescription>
                  This is a problem reaching the server. The card itself is unaffected.
                </AlertDescription>
              </AlertContent>
              <Button
                size="sm"
                color="error"
                variant="soft"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            </Alert>
          ) : isPending || !card ? (
            <PaneWaiting />
          ) : (
            <GiftCardBody card={card} />
          )}
        </div>
      </div>
    </div>
  );
}

function GiftCardBody({ card }: { card: GiftCardDetail }) {
  const toast = useToast();
  const confirm = useConfirm();
  const adjust = useAdjustGiftCard();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const amountCents = dollarsToCents(amount);
  const canAdjust = amountCents !== undefined && amountCents > 0 && reason.trim() !== '';

  const runAdjust = async (direction: 1 | -1) => {
    if (amountCents === undefined || amountCents <= 0 || reason.trim() === '') return;
    const delta = direction * amountCents;
    const newBalance = card.balanceCents + delta;
    if (newBalance < 0) {
      toast.add({
        title: 'That is more than the card holds',
        description: `You can take off at most ${formatCents(card.balanceCents, card.currency)}.`,
        type: 'error',
      });
      return;
    }
    const ok = await confirm({
      title: direction > 0 ? 'Add to this gift card?' : 'Take money off this gift card?',
      description: `The balance changes from ${formatCents(card.balanceCents, card.currency)} to ${formatCents(newBalance, card.currency)}. This is recorded in the card's history and cannot be undone.`,
      confirmLabel: direction > 0 ? 'Add the money' : 'Take it off',
      cancelLabel: 'Cancel',
      color: direction > 0 ? 'primary' : 'danger',
    });
    if (!ok) return;
    adjust.mutate(
      { giftCardId: card.id, deltaCents: delta, reason: reason.trim() },
      {
        onSuccess: () => {
          setAmount('');
          setReason('');
          toast.add({ title: 'Balance adjusted', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not adjust the balance',
            description: giftCardErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const state = giftCardState(card.status);

  return (
    <>
      <Text>{state.detail}</Text>

      <section className="card bg-base-100 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col">
            <Text className="text-sm">Balance</Text>
            <Text className="text-3xl font-semibold tabular-nums">
              {formatCents(card.balanceCents, card.currency)}
            </Text>
          </div>
          <Text className="text-sm">
            Started at {formatCents(card.initialBalanceCents, card.currency)}
          </Text>
        </div>
        <div className="border-base-300 flex flex-col gap-1 border-t pt-3 text-sm">
          {card.recipientName || card.recipientEmail ? (
            <Text>
              For {card.recipientName ?? card.recipientEmail}
              {card.recipientName && card.recipientEmail ? ` · ${card.recipientEmail}` : ''}
            </Text>
          ) : null}
          {card.message ? <Text>&ldquo;{card.message}&rdquo;</Text> : null}
          <Text>Issued {formatDate(card.createdAt)}</Text>
          {card.expiresAt ? <Text>Expires {formatDate(card.expiresAt)}</Text> : null}
        </div>
      </section>

      <FormSection
        title="Adjust the balance"
        description="Add money to the card, or take some off — for a refund kept on the card, or a correction. Every change is recorded below."
      >
        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>Amount</FieldLabel>
            <FieldControl
              render={
                <div className="flex items-center gap-2">
                  <Text as="span" className="text-lg">
                    $
                  </Text>
                  <Input
                    color="module"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    placeholder="10.00"
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                  />
                </div>
              }
            />
          </Field>
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={reason}
                  placeholder="Refund for order #1042"
                  onChange={(event) => {
                    setReason(event.target.value);
                  }}
                />
              }
            />
            <FieldDescription>Kept with the change so you remember why later.</FieldDescription>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            color="module"
            disabled={!canAdjust}
            loading={adjust.isPending}
            onClick={() => {
              void runAdjust(1);
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add to balance
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="danger"
            disabled={!canAdjust || card.balanceCents === 0}
            loading={adjust.isPending}
            onClick={() => {
              void runAdjust(-1);
            }}
          >
            <Icon glyph={faMinus} className="size-4" aria-hidden />
            Take off balance
          </Button>
        </div>
      </FormSection>

      <FormSection title="History" description="Every time money went onto or off this card.">
        {card.transactions.length === 0 ? (
          <Text className="text-sm">Nothing recorded yet.</Text>
        ) : (
          <ul className="flex flex-col">
            {card.transactions.map((entry) => (
              <li
                key={entry.id}
                className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <Text className="font-medium">{transactionMeaning(entry.reason)}</Text>
                  <Text className="text-sm">
                    {formatDate(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </Text>
                </div>
                <Badge
                  color={entry.deltaCents >= 0 ? 'success' : 'neutral'}
                  variant="soft"
                  size="sm"
                  className="tabular-nums"
                >
                  {entry.deltaCents >= 0 ? '+' : '−'}
                  {formatCents(Math.abs(entry.deltaCents), card.currency)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </>
  );
}
