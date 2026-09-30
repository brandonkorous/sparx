'use client';

// One wholesale invoice — raise it, then manage it through to paid.
//
// Create and manage are the SAME surface: `{ id: 'new' }` raises one, `{ id }`
// manages it. A raised invoice is a real, addressable thing you return to — so
// it is a pane, not a modal.
//
// Once raised, the identity (number, business, amount) is fixed; what you change
// afterwards is the due date, the note, and — the point of the screen — whether
// it has been paid. Recording payment is one method against a known balance, so
// THAT is a modal: nothing to return to, over in seconds. Writing it off is a
// decision, so it is a confirm.

import { useEffect, useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import {
  faBan,
  faBuilding,
  faFileInvoice,
  faHandHoldingDollar,
  faPrint,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneScope } from '../../lib/dock/window-boundary';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { openServerHtml } from '../../lib/api/html-artifact';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { MoneyInput } from '../../components/money-input';
import { SaveFailure } from '@/components/save-failure';
import {
  PAID_METHOD_LABELS,
  formatCents,
  formatDate,
  invoiceErrorMessage,
  invoiceState,
  useCreateInvoice,
  useInvoice,
  useInvoiceAccountChoices,
  useMarkInvoicePaid,
  useUpdateInvoice,
  useWriteOffInvoice,
  type InvoiceRow,
  type PaidMethod,
} from './invoices-data';
import { HALF_A_DAY, NOT_A_DATE, dayStartUtc } from '../../lib/today';
import { ChoiceListNote, choiceListState } from '../../components/choice-list-note';
import { DayInput } from '../../components/day-input';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** A due date input wants `YYYY-MM-DD`; the wire carries a full ISO datetime. */
function isoDateInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** A default due date two weeks out, so a fresh invoice opens with a sensible
 *  date rather than empty. */
function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function InvoiceDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <InvoiceCreate ctx={ctx} /> : <InvoiceLoader ctx={ctx} id={id} />;
}

function InvoiceLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const invoiceQuery = useInvoice(id);

  if (invoiceQuery.isError) {
    return (
      <div className={PANE_SHELL}>
        <div className={`${PANE_SHELL} p-2`}>
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneLoadError
              error={invoiceQuery.error}
              noun="invoice"
              title="Could not load this invoice"
              description="This is a problem reaching the server. The invoice itself is unaffected. Nothing has been lost."
              onRetry={() => {
                void invoiceQuery.refetch();
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  if (invoiceQuery.isPending || !invoiceQuery.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <InvoiceManage
      ctx={ctx}
      invoice={invoiceQuery.data}
      isFetching={invoiceQuery.isFetching}
      updatedAt={invoiceQuery.dataUpdatedAt}
      onRefresh={() => {
        void invoiceQuery.refetch();
      }}
    />
  );
}

/* ── Create ─────────────────────────────────────────────────────────────── */

function InvoiceCreate({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const create = useCreateInvoice();
  const accountsQuery = useInvoiceAccountChoices();

  const presetAccount = typeof ctx.params.accountId === 'string' ? ctx.params.accountId : '';

  const [accountId, setAccountId] = useState(presetAccount);
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  // The due date box's own half-typed state, which its `value` cannot
  // express. Held here rather than left to `DayInput`'s own warning because
  // this field ALREADY refuses on an empty box — two red lines saying
  // different things about one keystroke is the defect, not the fix.
  // [[feedback_one_outcome_two_causes]]
  const [dueHalfTyped, setDueHalfTyped] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    ctx.setTitle('New invoice');
  }, [ctx]);

  const mark = () => {
    setTouched(true);
  };

  const accountError = accountId === '' ? 'Choose which business this invoice is for.' : null;

  const amountError = amount <= 0 ? 'Enter how much this invoice is for.' : null;
  const dueIso = dueDate === '' ? null : dayStartUtc(dueDate);
  const dateError = dueHalfTyped
    ? HALF_A_DAY
    : dueDate === ''
      ? 'Set a due date.'
      : dueIso === null
        ? NOT_A_DATE
        : null;
  const blocking = accountError ?? amountError ?? dateError;

  const dirty =
    accountId !== presetAccount || number.trim() !== '' || amount !== 0 || notes.trim() !== '';

  useDirtySource(dirty && !create.isSuccess, 'This invoice has not been raised yet. Close anyway?');

  const accountItems = useMemo(
    () =>
      (accountsQuery.data?.items ?? []).map((account) => ({
        value: account.id,
        label: account.companyName,
      })),
    [accountsQuery.data]
  );

  const submit = () => {
    mark();
    if (blocking || dueIso === null) return;
    setFailure(null);
    create.mutate(
      {
        accountId,
        ...(number.trim() === '' ? {} : { invoiceNumber: number.trim() }),
        amountCents: Math.round(amount * 100),
        dueAt: dueIso,
        notes: notes.trim() === '' ? null : notes.trim(),
      },
      {
        onSuccess: (created) => {
          ctx.open('b2b.invoice.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `Invoice ${created.invoiceNumber} raised`, type: 'success' });
          });
        },
        onError: (error) => {
          setFailure(invoiceErrorMessage(error, 'Could not raise this invoice.'));
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="New invoice actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={create.isPending}
            onClick={submit}
          >
            Raise invoice
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>
            Bill a wholesale customer for work outside an order. An order placed on terms is billed
            for you.
          </Text>

          <SaveFailure title="Could not raise this invoice" message={failure} />

          <FormSection title="The invoice">
            <Field>
              <FieldLabel>For which business</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color={accountError && touched ? 'error' : 'module'}
                      aria-label="Which business"
                      placeholder={
                        accountsQuery.isPending
                          ? 'Loading your customers…'
                          : 'Choose a wholesale customer'
                      }
                      value={accountId}
                      items={accountItems}
                      onValueChange={(next) => {
                        setAccountId((next as string | null) ?? '');
                        mark();
                      }}
                    />
                  </div>
                }
              />
              {accountError && touched ? (
                <FieldStatus status="error">{accountError}</FieldStatus>
              ) : (
                <ChoiceListNote
                  state={choiceListState(accountsQuery)}
                  words={{
                    none: 'You have no wholesale customers yet. Add one under Wholesale customers first.',
                    noun: 'wholesale customers',
                  }}
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              {/* Optional, and that is the point (issue 757). It was required,
                  with a made-up "INV-1042" in the box as the only hint of the
                  shape, so the one screen that bills by hand asked a shop owner
                  to invent a number nothing else on the platform has ever asked
                  her for — and a number already in use came back as HTTP 500
                  under a red box that said nothing at all. */}
              <Field>
                <FieldLabel>Invoice number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={number}
                      placeholder="The next one in your run"
                      onChange={(event) => {
                        setNumber(event.target.value);
                        mark();
                      }}
                    />
                  }
                />
                <FieldDescription>
                  What they&apos;ll see on their bill. Leave it empty and the next number in your
                  run is used.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <FieldControl
                  render={
                    <div className="max-w-40">
                      <MoneyInput
                        color="module"
                        value={amount}
                        aria-label="Invoice amount"
                        onValueChange={(next) => {
                          setAmount(next);
                          mark();
                        }}
                      />
                    </div>
                  }
                />
                {amountError && touched ? (
                  <FieldStatus status="error">{amountError}</FieldStatus>
                ) : (
                  <FieldDescription>The total they owe.</FieldDescription>
                )}
              </Field>
            </div>

            <Field>
              <FieldLabel>Due date</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-48">
                    <DayInput
                      color={dateError && touched ? 'error' : 'module'}
                      value={dueDate}
                      aria-label="Due date"
                      sayWhenUnfinished={false}
                      onValueChange={(value, halfTyped) => {
                        setDueDate(value);
                        setDueHalfTyped(halfTyped);
                        mark();
                      }}
                    />
                  </div>
                }
              />
              {dateError && touched ? (
                <FieldStatus status="error">{dateError}</FieldStatus>
              ) : (
                <FieldDescription>When you expect to be paid by.</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>Note</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={notes}
                    placeholder="What this invoice is for."
                    onChange={(event) => {
                      setNotes(event.target.value);
                      mark();
                    }}
                  />
                }
              />
            </Field>
          </FormSection>
        </div>
      </div>
    </div>
  );
}

/* ── Manage ─────────────────────────────────────────────────────────────── */

function InvoiceManage({
  ctx,
  invoice,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  invoice: InvoiceRow;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const update = useUpdateInvoice(invoice.id);
  const writeOff = useWriteOffInvoice(invoice.id);

  const savedDate = isoDateInput(invoice.dueAt);
  const savedNotes = invoice.notes ?? '';
  const [dueDate, setDueDate] = useState(savedDate);
  const [notes, setNotes] = useState(savedNotes);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    ctx.setTitle(`Invoice ${invoice.invoiceNumber}`);
  }, [ctx, invoice.invoiceNumber]);

  useEffect(() => {
    setDueDate(isoDateInput(invoice.dueAt));
    setNotes(invoice.notes ?? '');
  }, [invoice.dueAt, invoice.notes]);

  const editable = invoice.status !== 'paid' && invoice.status !== 'void';
  const dirty = editable && (dueDate !== savedDate || notes !== savedNotes);
  // A date box can hold something that is not a date; see `lib/today`.
  const dueIso = dueDate === '' ? null : dayStartUtc(dueDate);
  const dateError = dueDate !== '' && dueIso === null ? NOT_A_DATE : null;

  useDirtySource(dirty, 'This invoice has unsaved changes. Close anyway?');

  const save = () => {
    if (dateError) {
      setFailure(dateError);
      return;
    }
    setFailure(null);
    update.mutate(
      {
        ...(dueDate !== savedDate && dueIso !== null ? { dueAt: dueIso } : {}),
        ...(notes !== savedNotes ? { notes } : {}),
      },
      {
        onSuccess: () => {
          toast.add({ title: 'Invoice saved', type: 'success' });
        },
        onError: (error) => {
          setFailure(invoiceErrorMessage(error, 'Could not save. Nothing was changed.'));
        },
      }
    );
  };

  const onWriteOff = async () => {
    const ok = await confirm({
      title: `Write off invoice ${invoice.invoiceNumber}?`,
      description:
        'This marks the invoice as never going to be paid and clears it from what they owe. Their credit is freed up again. This cannot be undone.',
      confirmLabel: 'Write it off',
      cancelLabel: 'Keep chasing it',
      color: 'danger',
    });
    if (!ok) return;
    writeOff.mutate(
      {},
      {
        onSuccess: () => {
          toast.add({ title: `Invoice ${invoice.invoiceNumber} written off`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not write off this invoice',
            description: invoiceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const state = invoiceState(invoice);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Invoice actions"
        status={
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        }
        primary={
          editable ? (
            <Button
              color="module"
              size="sm"
              className="ml-auto"
              loading={update.isPending}
              disabled={!dirty}
              onClick={save}
            >
              Save
            </Button>
          ) : null
        }
        // A bill she cannot hand over is not a bill (issue 759). This pane could
        // raise one, chase it, mark it paid and write it off, and had no way at
        // all to print it, email it or show it to the customer. Both of these
        // are the SAME billing document the Invoices screen owns, reached by the
        // same id — so rather than a second copy of the send machinery drifting
        // beside the first, the print is here (it needs only the id) and the
        // full document is one click away.
        actions={[
          {
            label: 'Print or save as PDF',
            icon: faPrint,
            title: 'Opens the bill as the customer sees it, to print or attach',
            onClick: () => {
              openServerHtml(`/v1/invoicing/documents/${invoice.id}/pdf`).catch(
                (error: unknown) => {
                  toast.add({
                    title: 'Could not open the print view',
                    description: error instanceof Error ? error.message : 'Try again in a moment.',
                    type: 'error',
                  });
                }
              );
            },
          },
          {
            label: 'Open the full bill',
            icon: faFileInvoice,
            title: 'The same bill on the Invoices screen, where you can email it and take payment',
            onClick: (event) => {
              ctx.open('invoicing.invoice.edit', { id: invoice.id }, { target: targetFor(event) });
            },
          },
        ]}
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {/* The number says WHICH bill, and it was on the tab alone. A pane can
              be popped into a window of its own, and the tab strip scrolls — so
              the one thing she and the customer both quote was the one thing
              that could leave the screen. sparx has carried this heading since
              it was written. [[feedback_a_fix_leaves_its_neighbour_behind]] */}
          <div className="flex flex-col gap-1">
            <Heading level={1} className="font-mono text-2xl font-semibold">
              Invoice {invoice.invoiceNumber}
            </Heading>
            <Text>
              {invoice.account ? invoice.account.companyName : 'A wholesale customer'} ·{' '}
              {formatCents(invoice.amountCents)}
            </Text>
          </div>

          <SaveFailure title="Could not save this invoice" message={failure} />

          <FormSection title="The money">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <Text as="span" className="text-sm">
                  Invoiced
                </Text>
                <Text as="span" className="tabular-nums">
                  {formatCents(invoice.amountCents)}
                </Text>
              </div>
              <div className="border-base-300 flex items-center justify-between gap-4 border-t pt-2">
                <Text as="span" className="font-semibold">
                  {invoice.balanceCents > 0 ? 'Still owed' : 'Settled'}
                </Text>
                <Text as="span" className="text-lg font-semibold tabular-nums">
                  {formatCents(invoice.balanceCents)}
                </Text>
              </div>
            </div>
            {invoice.status === 'paid' ? (
              <Text className="text-sm">
                Paid {formatDate(invoice.paidAt)}
                {invoice.paidMethod
                  ? ` · ${PAID_METHOD_LABELS[invoice.paidMethod as PaidMethod] ?? invoice.paidMethod}`
                  : ''}
                {invoice.paidBy
                  ? ` · recorded by ${invoice.paidBy.name ?? invoice.paidBy.email}`
                  : ''}
                .
              </Text>
            ) : null}
          </FormSection>

          <FormSection title="Terms">
            <Field>
              <FieldLabel>Due date</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-48">
                    <DayInput
                      color="module"
                      value={dueDate}
                      disabled={!editable}
                      aria-label="Due date"
                      onValueChange={(value) => {
                        setDueDate(value);
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                {editable
                  ? 'When you expect to be paid by.'
                  : 'This invoice is closed. Its due date is fixed.'}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Note</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={notes}
                    disabled={!editable}
                    placeholder="What this invoice is for."
                    onChange={(event) => {
                      setNotes(event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>

          {invoice.account ? (
            <ModuleScope module="b2b">
              <FormSection title="The business">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Text className="font-medium">{invoice.account.companyName}</Text>
                  <Button
                    size="sm"
                    variant="soft"
                    color="module"
                    onClick={(event) => {
                      if (!invoice.account) return;
                      ctx.open(
                        'b2b.account.detail',
                        { id: invoice.account.id },
                        { target: targetFor(event) }
                      );
                    }}
                  >
                    <Icon glyph={faBuilding} className="size-4" aria-hidden />
                    Open account
                  </Button>
                </div>
              </FormSection>
            </ModuleScope>
          ) : null}

          {/* Money moves + the terminal action, after the work, under a divider */}
          {invoice.status !== 'void' ? (
            <div className="border-base-300 flex flex-wrap items-center gap-3 border-t pt-4">
              {invoice.balanceCents > 0 ? <MarkPaidDialog invoice={invoice} /> : null}
              {invoice.status !== 'paid' ? (
                <Button
                  size="sm"
                  variant="outline"
                  color="danger"
                  className="ml-auto"
                  loading={writeOff.isPending}
                  onClick={() => {
                    void onWriteOff();
                  }}
                >
                  <Icon glyph={faBan} className="size-4" aria-hidden />
                  Write off
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Mark paid ──────────────────────────────────────────────────────────── */

const METHOD_OPTIONS: { value: PaidMethod; label: string }[] = (
  Object.keys(PAID_METHOD_LABELS) as PaidMethod[]
).map((method) => ({ value: method, label: PAID_METHOD_LABELS[method] }));

function MarkPaidDialog({ invoice }: { invoice: InvoiceRow }) {
  const toast = useToast();
  const markPaid = useMarkInvoicePaid(invoice.id);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaidMethod>('ach');
  const [note, setNote] = useState('');

  const record = () => {
    markPaid.mutate(
      { paidMethod: method, notes: note.trim() === '' ? undefined : note.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          afterPaneChange(() => {
            toast.add({
              title: `Invoice ${invoice.invoiceNumber} paid`,
              description: 'The balance is cleared.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not mark this paid',
            description: invoiceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setMethod('ach');
            setNote('');
            markPaid.reset();
          }
        }}
      >
        <DialogTrigger>
          <Button color="module" variant="soft" size="sm">
            <Icon glyph={faHandHoldingDollar} className="size-4" aria-hidden />
            Mark as paid
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>
            Records the full {formatCents(invoice.balanceCents)} owed on invoice{' '}
            {invoice.invoiceNumber} as received, and frees up the account&apos;s credit.
          </DialogDescription>

          <div className="flex flex-col gap-4 py-2">
            <Field>
              <FieldLabel>How they paid</FieldLabel>
              <Select
                color="module"
                items={METHOD_OPTIONS}
                value={method}
                aria-label="How they paid"
                onValueChange={(next) => {
                  setMethod((next as PaidMethod | null) ?? 'ach');
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Note</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={note}
                    placeholder="Check number, reference…"
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>Optional: whatever helps you find it later.</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose>
              <Button size="sm">Cancel</Button>
            </DialogClose>
            <Button color="module" size="sm" loading={markPaid.isPending} onClick={record}>
              Mark {formatCents(invoice.balanceCents)} paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
