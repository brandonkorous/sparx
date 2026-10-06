'use client';

// One trade account — create it, then manage it. Create and manage are the SAME
// surface: `{ id: 'new' }` builds it, `{ id }` manages it, so a create is a pane
// in its "new" state, never a second form.
//
// A trade account is a business you supply on agreed prices and terms. It has:
//
//   1. WHO they are     — company name, tax number, website.
//   2. HOW they buy      — a price tier, a credit limit, payment terms, an
//                          across-the-board discount, and whether they're open.
//   3. WHO can order     — the people at that business allowed to place orders.
//
// A save writes to two places at once: the identity is a CRM record, the trade
// terms are the B2B module's enrichment of it. That split is invisible here —
// one Save button, one draft.

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
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
import { FileText, Receipt, ShoppingCart, Trash2, UserPlus } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { CustomPropertiesPanel } from '../crm/custom-properties-panel';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { MoneyInput } from '@/components/money-input';
import { CustomerPicker, customerName, type CustomerSummary } from '../invoicing/customer-picker';
import { PaymentTermsField } from '../../components/payment-terms-field';
import { SaveFailure } from '@/components/save-failure';
import {
  CONTACT_ROLE_LABELS,
  alreadyOnAccount,
  accountErrorMessage,
  accountState,
  formatCents,
  paymentTermsLabel,
  useAccount,
  useAccountContacts,
  useAddContact,
  useCreateAccount,
  useDeleteAccount,
  useSaveAccount,
  accountTierWords,
  tierChoiceItems,
  useSetAccountTier,
  useTierChoices,
  useUpdateContact,
  type AccountContact,
  type AccountDetail,
  type AccountStatus,
  type ContactRole,
  type PaymentTerms,
} from './accounts-data';
import { creditStanding } from '../../lib/credit-standing';
import { TaxExemptionsNotYet, TaxExemptionsSection } from '../commerce/tax-exemptions-section';
import { PaneLoadError } from '../../components/pane-load-error';
import { APPROVER_ROLE_MEANING } from './sign-off-words';
import { AccountStatementSection } from './account-statement';
import { AccountFleet } from './account-fleet';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: 'Open for orders' },
  { value: 'credit_hold', label: 'On credit hold: no new orders until paid' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Closed' },
];

interface Draft {
  companyName: string;
  taxId: string;
  website: string;
  tierId: string;
  /** Whole currency units while editing (MoneyInput works in dollars). */
  creditLimit: number;
  /** `''` (nothing agreed), `prepay`, or `netN`. A blank is NOT a
   *  day count of zero. See lib/payment-terms.ts. */
  paymentTerms: PaymentTerms;
  discountPercent: number;
  status: AccountStatus;
  notes: string;
  fleetSize: string;
  /** The extra details THIS business tracks on a company (docs/144 §3). */
  customProperties: Record<string, unknown>;
}

function emptyDraft(): Draft {
  return {
    companyName: '',
    taxId: '',
    website: '',
    tierId: '',
    creditLimit: 0,
    paymentTerms: '',
    discountPercent: 0,
    status: 'active',
    notes: '',
    fleetSize: '',
    customProperties: {},
  };
}

function toDraft(account: AccountDetail): Draft {
  return {
    companyName: account.companyName,
    taxId: account.taxId ?? '',
    website: account.website ?? '',
    tierId: account.pricingTierId ?? '',
    creditLimit: account.creditLimitCents / 100,
    paymentTerms: account.paymentTerms ?? '',
    discountPercent: account.discountPercent,
    status: account.status,
    notes: account.notes ?? '',
    fleetSize: account.fleetSize != null ? String(account.fleetSize) : '',
    customProperties: account.customProperties ?? {},
  };
}

/** A website a person typed without a scheme still has to satisfy the server's
 *  URL check — so "acme.com" becomes "https://acme.com" on the way out. */
function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * The note under the Credit limit box.
 *
 * It said "Leave at zero for no credit", which is right about the outcome and
 * silent about the stakes: the checkout works out `creditLimit - creditUsed`
 * and refuses anything larger, so a zero turns every order on terms away. It
 * also had two branches, and an account owing money behind a closed door fell
 * into the wrong one.
 */
function creditFieldNote(account: AccountDetail | undefined): string {
  if (account) {
    const standing = creditStanding(account.creditLimitCents, account.creditUsedCents);
    if (standing === 'limit') {
      return account.creditRemainingCents > 0
        ? `They have used ${formatCents(account.creditUsedCents)} of this, with ${formatCents(account.creditRemainingCents)} left.`
        : `They have used all of this, and ${formatCents(account.creditUsedCents)} in total.`;
    }
    if (standing === 'owing') {
      return `They still owe you ${formatCents(account.creditUsedCents)}, and cannot order on terms until you put an amount here.`;
    }
    return 'They cannot order on terms. Put an amount here to let them, up to that much at once.';
  }
  return 'The most they can owe you at once on terms. Left at zero, they cannot order on terms at all.';
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/* ── Surface ────────────────────────────────────────────────────────────── */

export function AccountDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <AccountEditor ctx={ctx} id="new" /> : <AccountLoader ctx={ctx} id={id} />;
}

function AccountLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const accountQuery = useAccount(id);

  if (accountQuery.isError) {
    return (
      <PaneLoadError
        error={accountQuery.error}
        noun="account"
        title="Could not load this account"
        description="This is a problem reaching the server. The account itself is unaffected. Nothing has been lost."
        onRetry={() => {
          void accountQuery.refetch();
        }}
      />
    );
  }

  if (accountQuery.isPending || !accountQuery.data) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <AccountEditor ctx={ctx} id={id} account={accountQuery.data} />;
}

function AccountEditor({
  ctx,
  id,
  account,
}: {
  ctx: SurfaceContext;
  id: string;
  account?: AccountDetail;
}) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateAccount();
  const save = useSaveAccount(id);
  const setTier = useSetAccountTier();
  const remove = useDeleteAccount(id);

  const tiersQuery = useTierChoices();

  const saved = useMemo(() => (account ? toDraft(account) : emptyDraft()), [account]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New account' : (account?.companyName ?? 'Account'));
  }, [ctx, isNew, account]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  /* ── Validation ─────────────────────────────────────────────────────── */

  const nameError = draft.companyName.trim() === '' ? 'Give this account a company name.' : null;
  const discountError =
    draft.discountPercent < 0 || draft.discountPercent > 100
      ? 'The discount has to be between 0% and 100%.'
      : null;
  const fleetError =
    draft.fleetSize !== '' && (Number.isNaN(Number(draft.fleetSize)) || Number(draft.fleetSize) < 0)
      ? 'The fleet size has to be a whole number, or left blank.'
      : null;
  const blocking = nameError ?? discountError ?? fleetError;

  /* ── Dirty ──────────────────────────────────────────────────────────── */

  const dirty = isNew
    ? draft.companyName.trim() !== '' ||
      draft.taxId.trim() !== '' ||
      draft.website.trim() !== '' ||
      draft.tierId !== '' ||
      draft.creditLimit !== 0 ||
      draft.paymentTerms !== '' ||
      draft.discountPercent !== 0 ||
      draft.status !== 'active' ||
      draft.notes.trim() !== ''
    : draft.companyName !== saved.companyName ||
      draft.taxId !== saved.taxId ||
      draft.website !== saved.website ||
      draft.tierId !== saved.tierId ||
      draft.creditLimit !== saved.creditLimit ||
      draft.paymentTerms !== saved.paymentTerms ||
      draft.discountPercent !== saved.discountPercent ||
      draft.status !== saved.status ||
      draft.notes !== saved.notes ||
      draft.fleetSize !== saved.fleetSize;

  const saving = create.isPending || save.isPending || setTier.isPending;

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This account has not been created yet. Close anyway?'
      : 'This account has unsaved changes. Close anyway?'
  );

  /* ── Save ───────────────────────────────────────────────────────────── */

  const submit = () => {
    if (blocking) return;
    setFailure(null);

    const identity = {
      companyName: draft.companyName.trim(),
      taxId: draft.taxId.trim() === '' ? null : draft.taxId.trim(),
      website: normalizeWebsite(draft.website),
      creditLimit: draft.creditLimit,
      paymentTerms: draft.paymentTerms === '' ? null : draft.paymentTerms,
      discountPercent: draft.discountPercent,
      status: draft.status,
      notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
    };

    if (isNew) {
      create.mutate(identity, {
        onSuccess: (created) => {
          const land = () => {
            ctx.open('b2b.account.detail', { id: created.id }, { target: 'replace' });
            afterPaneChange(() => {
              toast.add({ title: `${identity.companyName} added`, type: 'success' });
            });
          };
          if (draft.tierId !== '') {
            setTier.mutate({ id: created.id, pricingTierId: draft.tierId }, { onSettled: land });
          } else {
            land();
          }
        },
        onError: (error) => {
          setFailure(accountErrorMessage(error, 'Could not add this account.'));
        },
      });
      return;
    }

    save.mutate(
      {
        identity: {
          companyName: identity.companyName,
          taxId: identity.taxId,
          website: identity.website,
        },
        trade: {
          pricingTierId: draft.tierId === '' ? null : draft.tierId,
          creditLimitCents: Math.round(draft.creditLimit * 100),
          paymentTerms: identity.paymentTerms,
          discountPercent: draft.discountPercent,
          status: draft.status,
          internalNotes: identity.notes,
          fleetSize: draft.fleetSize === '' ? null : Number(draft.fleetSize),
          customProperties: draft.customProperties,
        },
      },
      {
        onSuccess: () => {
          setTouched(false);
          toast.add({ title: 'Account saved', type: 'success' });
        },
        onError: (error) => {
          setFailure(
            accountErrorMessage(error, 'Could not save this account. Nothing was changed.')
          );
        },
      }
    );
  };

  /* ── Delete ─────────────────────────────────────────────────────────── */

  const onDelete = async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Remove ${account.companyName}?`,
      description:
        'This account, its agreed prices and its list of contacts are removed. Orders and invoices already placed are kept. This cannot be undone.',
      confirmLabel: 'Remove this account',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${account.companyName} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this account',
          description: accountErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const tierItems = useMemo(
    () =>
      tierChoiceItems(tiersQuery.data?.items, 'No tier: normal prices', {
        id: account?.pricingTierId ?? null,
        name: account?.pricingTierName ?? account?.removedTierName ?? null,
        removed: Boolean(account?.removedTierName),
      }),
    [tiersQuery.data, account?.pricingTierId, account?.pricingTierName, account?.removedTierName]
  );

  const state = account ? accountState(account.status) : null;

  const openList = (surface: string, event: { shiftKey: boolean; altKey: boolean }) => {
    if (!account) return;
    ctx.open(
      surface,
      { accountId: account.id, accountName: account.companyName },
      { target: targetFor(event) }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Account actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={saving}
            disabled={Boolean(nameError) || (!isNew && !dirty)}
            onClick={submit}
          >
            {isNew ? 'Add account' : 'Save'}
          </Button>
        }
        controls={
          <>
            {state ? (
              <Badge color={state.tone} variant="soft" size="sm">
                {state.label}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a trade account
              </Heading>
              <Text>
                Set up a business you supply on agreed prices and terms. Once it&apos;s saved you
                can add the people who order for them and see their orders, quotes and invoices.
              </Text>
            </div>
          ) : account ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                {account.companyName}
              </Heading>
              <Text className="text-sm">
                {accountTierWords(account) ? `${accountTierWords(account)} · ` : ''}
                {paymentTermsLabel(account.paymentTerms)}
              </Text>
            </div>
          ) : null}

          <SaveFailure title="Could not save this account" message={failure} />

          {/* 1 — Who they are */}
          <FormSection title="Who they are">
            <Field>
              <FieldLabel>Company name</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={nameError && touched ? 'error' : 'module'}
                    value={draft.companyName}
                    placeholder="Acme Building Supplies"
                    onChange={(event) => {
                      set('companyName', event.target.value);
                    }}
                  />
                }
              />
              {nameError && touched ? (
                <FieldStatus status="error">{nameError}</FieldStatus>
              ) : (
                <FieldDescription>The business you&apos;re selling to.</FieldDescription>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel>Tax number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.taxId}
                      placeholder="Optional"
                      onChange={(event) => {
                        set('taxId', event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Their VAT or business tax number, if you need it on their paperwork.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Website</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.website}
                      placeholder="acme.com"
                      onChange={(event) => {
                        set('website', event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>
            </div>
          </FormSection>

          {/* 2 — How they buy */}
          <FormSection
            title="How they buy"
            description="The prices and terms this business gets. Set once here instead of on every order."
          >
            <Field>
              <FieldLabel>Price tier</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Price tier"
                      value={draft.tierId}
                      items={tierItems}
                      onValueChange={(next) => {
                        set('tierId', (next as string | null) ?? '');
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                A named discount level (trade, distributor, key account) set up under Price tiers.
                Leave it on normal prices to charge them the same as everyone else.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel>Credit limit</FieldLabel>
                <FieldControl
                  render={
                    <div className="max-w-40">
                      <MoneyInput
                        color="module"
                        value={draft.creditLimit}
                        aria-label="Credit limit"
                        onValueChange={(next) => {
                          set('creditLimit', next);
                        }}
                      />
                    </div>
                  }
                />
                <FieldDescription>{creditFieldNote(account)}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Extra discount</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex max-w-40 items-center gap-1">
                      <Input
                        color={discountError && touched ? 'error' : 'module'}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        className="text-right tabular-nums"
                        aria-label="Extra discount percentage"
                        value={String(draft.discountPercent)}
                        onChange={(event) => {
                          set('discountPercent', Number(event.target.value) || 0);
                        }}
                      />
                      <Text as="span" className="text-sm">
                        % off
                      </Text>
                    </div>
                  }
                />
                {discountError && touched ? (
                  <FieldStatus status="error">{discountError}</FieldStatus>
                ) : (
                  <FieldDescription>
                    Taken off everything, on top of their tier. Leave at zero for none.
                  </FieldDescription>
                )}
              </Field>
            </div>

            <Field>
              <FieldLabel>When they pay</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <PaymentTermsField
                      value={draft.paymentTerms}
                      onChange={(next) => {
                        set('paymentTerms', next);
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                How long they have to pay after you invoice them. Leave unset to take payment up
                front.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Standing</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Account standing"
                      value={draft.status}
                      items={STATUS_OPTIONS}
                      onValueChange={(next) => {
                        set('status', (next as AccountStatus | null) ?? 'active');
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                Put them on credit hold to stop new orders until they&apos;ve paid what they owe.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Private note</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={draft.notes}
                    placeholder="Anything your team should know about this account. Only you see this."
                    onChange={(event) => {
                      set('notes', event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>

          {/* The extra details this business tracks on a company (docs/144 §3).
              The SAME bag the CRM's company pane edits — one record, one set of
              fields, whichever door you came in through. */}
          <CustomPropertiesPanel
            objectKey="company"
            values={draft.customProperties}
            onChange={(next) => {
              set('customProperties', next);
            }}
          />

          {/* 3 — Who can order */}
          {isNew ? (
            <FormSection title="Who can order">
              <Text className="text-sm">
                Save the account first, then add the people at this business who are allowed to
                place orders.
              </Text>
            </FormSection>
          ) : account ? (
            <ContactsSection ctx={ctx} accountId={account.id} />
          ) : null}

          {/* 4 — Tax exemption: the certificate a reseller or a farm keeps on the
              business, read at checkout for everyone ordering on its behalf. */}
          {isNew ? (
            <TaxExemptionsNotYet noun="account" />
          ) : account ? (
            <TaxExemptionsSection companyId={account.id} name={account.companyName} />
          ) : null}

          {/* 5 - Their fleet: add, change and remove the vehicles this business
              runs, which decides what their buyers see as fitting on the website
              (sparx persona issue 086). The fleet size still saves with the pane. */}
          {isNew ? (
            <FormSection title="Their fleet">
              <Text className="text-sm">
                Save the account first, then add the vehicles this business runs.
              </Text>
            </FormSection>
          ) : account ? (
            <AccountFleet
              ctx={ctx}
              accountId={account.id}
              sizeField={
                <Field>
                  <FieldLabel>Fleet size</FieldLabel>
                  <FieldControl
                    render={
                      <div className="max-w-40">
                        <Input
                          color={fleetError && touched ? 'error' : 'module'}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          className="text-right tabular-nums"
                          aria-label="Fleet size"
                          value={draft.fleetSize}
                          onChange={(event) => {
                            set('fleetSize', event.target.value);
                          }}
                        />
                      </div>
                    }
                  />
                  {fleetError && touched ? (
                    <FieldStatus status="error">{fleetError}</FieldStatus>
                  ) : (
                    <FieldDescription>How many units they run in total.</FieldDescription>
                  )}
                </Field>
              }
            />
          ) : null}

          {/* Trade activity cross-links */}
          {account ? (
            <FormSection
              title="Their trade activity"
              description="Everything this account has going on with you, filtered to just them."
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  color="module"
                  onClick={(event) => {
                    openList('b2b.orders.list', event);
                  }}
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  Their orders
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  color="module"
                  onClick={(event) => {
                    openList('b2b.quotes.list', event);
                  }}
                >
                  <FileText className="size-4" aria-hidden />
                  Their quotes
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  color="module"
                  onClick={(event) => {
                    openList('b2b.invoices.list', event);
                  }}
                >
                  <Receipt className="size-4" aria-hidden />
                  Their invoices
                </Button>
              </div>
            </FormSection>
          ) : null}

          {/* Statement: opening, every invoice and payment with their PO
              numbers, closing and aging, to print or email to them. */}
          {account ? (
            <AccountStatementSection accountId={account.id} companyName={account.companyName} />
          ) : null}

          {/* Delete — a plain row after the work, under a divider */}
          {account ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">
                Remove this account and its agreed prices. Orders and invoices already placed are
                kept.
              </Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                loading={remove.isPending}
                onClick={() => {
                  void onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove account
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Contacts ───────────────────────────────────────────────────────────── */

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = (
  Object.keys(CONTACT_ROLE_LABELS) as ContactRole[]
).map((role) => ({ value: role, label: CONTACT_ROLE_LABELS[role] }));

function ContactsSection({ ctx, accountId }: { ctx: SurfaceContext; accountId: string }) {
  const toast = useToast();
  const contactsQuery = useAccountContacts(accountId);
  const addContact = useAddContact(accountId);
  const updateContact = useUpdateContact(accountId);

  const [picked, setPicked] = useState<CustomerSummary | null>(null);
  // Bumped after each add, so the picker starts empty again instead of still
  // showing the name just added and offering them a second time (sparx persona
  // issue 086).
  const [pickerRound, setPickerRound] = useState(0);
  const [role, setRole] = useState<ContactRole>('buyer');

  // What "Can approve orders" actually does is said where the role is picked
  // (the section's description, read with every picker in it). The role did
  // nothing at all until a spending limit could be signed off by the account's
  // own approvers, and nothing here said where that is set (sparx persona
  // issue 087).
  const contacts = contactsQuery.data?.items ?? [];
  const active = contacts.filter((contact) => contact.isActive);
  const inactive = contacts.filter((contact) => !contact.isActive);

  const onAdd = () => {
    if (!picked) return;
    addContact.mutate(
      { customerId: picked.id, role },
      {
        onSuccess: () => {
          setPicked(null);
          setPickerRound((round) => round + 1);
          setRole('buyer');
          toast.add({ title: `${customerName(picked)} added`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that person',
            description: accountErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <FormSection
      title="Who can order"
      description={`The people at this business allowed to place orders on its behalf, and what each is allowed to do. ${APPROVER_ROLE_MEANING}`}
    >
      {contactsQuery.isError ? (
        <Text className="text-sm">Their contacts could not be loaded just now.</Text>
      ) : contactsQuery.isPending ? (
        <Text className="text-sm" role="status">
          Loading contacts…
        </Text>
      ) : active.length === 0 && inactive.length === 0 ? (
        <Text className="text-sm">
          No one is set up to order for this account yet. Add someone below. They must already be a
          customer of yours.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...inactive].map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              busy={updateContact.isPending}
              onRole={(next) => {
                updateContact.mutate({ contactId: contact.id, role: next });
              }}
              onToggleActive={() => {
                updateContact.mutate({ contactId: contact.id, isActive: !contact.isActive });
              }}
            />
          ))}
        </ul>
      )}

      <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
        <Heading level={3} className="text-base font-semibold">
          Add someone
        </Heading>
        <div className="flex flex-col gap-3">
          <CustomerPicker
            key={pickerRound}
            value={picked?.id ?? null}
            unavailable={alreadyOnAccount(contacts)}
            onSelect={(customer) => {
              setPicked(customer);
            }}
            onClear={() => {
              setPicked(null);
            }}
            onAddNew={(typed) => {
              // Opened with the name already typed and this business already
              // chosen, so she saves once and comes back to a person who is
              // already a member. Issue 745.
              ctx.open('crm.customer.detail', { id: 'new', name: typed, companyId: accountId });
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Select
                size="sm"
                color="module"
                aria-label="What this person can do"
                value={role}
                items={ROLE_OPTIONS}
                onValueChange={(next) => {
                  setRole((next as ContactRole | null) ?? 'buyer');
                }}
              />
            </div>
            <Button
              size="sm"
              color="module"
              disabled={!picked}
              loading={addContact.isPending}
              onClick={onAdd}
            >
              <UserPlus className="size-4" aria-hidden />
              Add
            </Button>
          </div>
        </div>
      </div>
    </FormSection>
  );
}

function contactName(contact: AccountContact): string {
  const person = [contact.customer.firstName, contact.customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (person !== '') return person;
  return contact.customer.company ?? contact.customer.email ?? 'Unnamed contact';
}

/** A removed person can no longer order or approve for the account. It is a
 *  `warning`, not a `danger`: the person is set aside and can be added back,
 *  where red is kept for a suspended account or a failed payment. */
const REMOVED = { label: 'Removed', tone: 'warning' } as const;

function ContactRow({
  contact,
  busy,
  onRole,
  onToggleActive,
}: {
  contact: AccountContact;
  busy: boolean;
  onRole: (role: ContactRole) => void;
  onToggleActive: () => void;
}) {
  // Asked first. Remove is one click and the list re-sorts after every change,
  // so after Restore the pointer sat on the NEXT person's Remove: a double click
  // took the account's only approver away, with nothing to say so (sparx persona
  // issue 091). Restore needs no question; it gives access back.
  const confirm = useConfirm();
  const onToggle = async () => {
    if (contact.isActive) {
      const name = contactName(contact);
      const ok = await confirm({
        title: `Remove ${name} from this account?`,
        description: `${name} will no longer be able to use this account on your site. Orders they already placed stay as they are. You can restore them here at any time.`,
        confirmLabel: `Remove ${name}`,
        cancelLabel: 'Keep them',
        color: 'danger',
      });
      if (!ok) return;
    }
    onToggleActive();
  };
  return (
    <li className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{contactName(contact)}</span>
        {contact.customer.email ? (
          <Text as="span" className="block text-sm">
            {contact.customer.email}
          </Text>
        ) : null}
      </span>
      {contact.isActive ? (
        <div className="w-52 shrink-0">
          <Select
            size="sm"
            color="module"
            aria-label={`What ${contactName(contact)} can do`}
            value={contact.role}
            items={ROLE_OPTIONS}
            onValueChange={(next) => {
              onRole((next as ContactRole | null) ?? contact.role);
            }}
          />
        </div>
      ) : (
        <Badge color={REMOVED.tone} variant="soft" size="sm">
          {REMOVED.label}
        </Badge>
      )}
      <Button
        size="sm"
        variant="ghost"
        color={contact.isActive ? 'danger' : 'module'}
        disabled={busy}
        onClick={() => {
          void onToggle();
        }}
      >
        {contact.isActive ? 'Remove' : 'Restore'}
      </Button>
    </li>
  );
}
