'use client';

// One wholesale account — create it, then manage it.
//
// Create and manage are the same surface: `{ id: 'new' }` builds it, `{ id }`
// manages it. An account is the BUSINESS you trade with — its credit limit, its
// discount, its payment terms. Its people are customers of the `b2b` kind linked
// to it from their own records. This is an editable entity, so its name is a
// field at the top, not a repeated read-only heading. Removing an account is
// rare, irreversible and admin-only, so it sits in a quiet row after the work.

import { useEffect, useMemo, useState } from 'react';
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
  Heading,
  Input,
  Select,
  TagInput,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Trash2 } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useTeamRoster } from '../../lib/api/team';
import { useViewer } from '../../lib/api/shell-data';
import {
  ACCOUNT_STATUSES,
  accountErrorMessage,
  accountStatusMeta,
  formatMoney,
  PAYMENT_TERMS,
  useAccount,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type AccountInput,
  type B2BAccount,
  type B2BAccountStatus,
  type PaymentTerms,
} from './accounts-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/* ── Draft ──────────────────────────────────────────────────────────────── */

interface Draft {
  companyName: string;
  website: string;
  taxId: string;
  status: B2BAccountStatus;
  creditLimit: string;
  paymentTerms: string;
  discountPercent: string;
  pricingTier: string;
  assignedRepId: string;
  fleetSize: string;
  notes: string;
  tags: string[];
}

function emptyDraft(): Draft {
  return {
    companyName: '',
    website: '',
    taxId: '',
    status: 'active',
    creditLimit: '',
    paymentTerms: '',
    discountPercent: '',
    pricingTier: '',
    assignedRepId: '',
    fleetSize: '',
    notes: '',
    tags: [],
  };
}

function numberOrEmpty(value: string): string {
  return value.trim();
}

function toDraft(a: B2BAccount): Draft {
  const credit = Number(a.creditLimit);
  const discount = Number(a.discountPercent);
  return {
    companyName: a.companyName,
    website: a.website ?? '',
    taxId: a.taxId ?? '',
    status: (a.status as B2BAccountStatus) ?? 'active',
    creditLimit: credit > 0 ? String(credit) : '',
    paymentTerms: a.paymentTerms ?? '',
    discountPercent: discount > 0 ? String(discount) : '',
    pricingTier: a.pricingTier ?? '',
    assignedRepId: a.assignedRepId ?? '',
    fleetSize: a.fleetSize === null ? '' : String(a.fleetSize),
    notes: a.notes ?? '',
    tags: a.tags,
  };
}

const trimOrNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
const URL_RE = /^https?:\/\/.+\..+/i;

/* ── Surface ────────────────────────────────────────────────────────────── */

export function AccountDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <AccountEditor ctx={ctx} id="new" /> : <AccountLoader ctx={ctx} id={id} />;
}

function AccountLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: account, isPending, isError, refetch } = useAccount(id);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this account</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the account has been removed. Nothing has
              been changed.
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
      </div>
    );
  }

  if (isPending || !account) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <AccountEditor ctx={ctx} id={id} account={account} />;
}

function AccountEditor({
  ctx,
  id,
  account,
}: {
  ctx: SurfaceContext;
  id: string;
  account?: B2BAccount;
}) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateAccount();
  const update = useUpdateAccount(id);
  const remove = useDeleteAccount(id);

  const { members } = useTeamRoster();
  const { data: viewer } = useViewer();
  const canDelete = viewer?.role === 'admin' || viewer?.role === 'owner';

  const saved = useMemo(() => (account ? toDraft(account) : emptyDraft()), [account]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New account' : account ? account.companyName : 'Account');
  }, [ctx, isNew, account]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = create.isPending || update.isPending;

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This account has not been created yet. Close anyway?'
      : 'This account has unsaved changes. Close anyway?'
  );

  const repItems = useMemo(() => {
    const items: Record<string, string> = { '': 'No one assigned' };
    for (const m of members) items[m.userId] = m.name ?? m.email;
    if (draft.assignedRepId && !items[draft.assignedRepId]) {
      items[draft.assignedRepId] = 'A former team member';
    }
    return items;
  }, [members, draft.assignedRepId]);

  /* ── Validation ───────────────────────────────────────────────────────── */

  const nameError = draft.companyName.trim() === '' ? 'Give the business a name.' : null;
  const websiteError =
    draft.website.trim() !== '' && !URL_RE.test(draft.website.trim())
      ? 'Enter a full web address, starting with http:// or https://.'
      : null;
  const creditError =
    draft.creditLimit.trim() !== '' && !(Number(draft.creditLimit) >= 0)
      ? 'Enter the credit limit as a number, or leave it blank for none.'
      : null;
  const discountError =
    draft.discountPercent.trim() !== '' &&
    !(Number(draft.discountPercent) >= 0 && Number(draft.discountPercent) <= 100)
      ? 'Enter a discount between 0 and 100.'
      : null;
  const blocked = nameError ?? websiteError ?? creditError ?? discountError;

  const failure =
    create.isError || update.isError
      ? accountErrorMessage(
          create.error ?? update.error,
          'Could not save this account. Nothing was changed.'
        )
      : null;

  /* ── Build + submit ───────────────────────────────────────────────────── */

  const buildInput = (): AccountInput => ({
    companyName: draft.companyName.trim(),
    website: trimOrNull(draft.website),
    taxId: trimOrNull(draft.taxId),
    pricingTier: trimOrNull(draft.pricingTier),
    status: draft.status,
    creditLimit: draft.creditLimit.trim() === '' ? 0 : Number(draft.creditLimit),
    discountPercent: draft.discountPercent.trim() === '' ? 0 : Number(draft.discountPercent),
    paymentTerms: draft.paymentTerms ? (draft.paymentTerms as PaymentTerms) : null,
    assignedRepId: draft.assignedRepId || null,
    fleetSize: draft.fleetSize.trim() === '' ? null : Number(draft.fleetSize),
    notes: trimOrNull(draft.notes),
    tags: draft.tags,
  });

  const submit = () => {
    if (blocked) return;
    const input = buildInput();

    if (isNew) {
      create.mutate(input, {
        onSuccess: (created) => {
          ctx.open('crm.account.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${created.companyName} added`, type: 'success' });
          });
        },
      });
      return;
    }

    update.mutate(input, {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: 'Account saved', type: 'success' });
      },
    });
  };

  const onDelete = async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Remove ${account.companyName}?`,
      description:
        'This takes the account out of your lists. Its past orders and history are kept for your records, and the people linked to it stay as customers. You can add it again later.',
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

  const meta = accountStatusMeta(draft.status);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Wholesale account actions">
        <Badge color={meta.tone} variant="soft" size="sm">
          {meta.label}
        </Badge>
        {account && Number(account.creditUsed) > 0 ? (
          <Text as="span" className="hidden shrink-0 text-sm @md:inline">
            {formatMoney(account.creditUsed)} of {formatMoney(account.creditLimit)} used
          </Text>
        ) : null}
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          loading={saving}
          disabled={Boolean(blocked) || (!isNew && !dirty)}
          onClick={submit}
        >
          {isNew ? 'Add account' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a wholesale account
              </Heading>
              <Text>
                Set up a business that buys from you at agreed prices. You can add its buyers as
                customers afterwards.
              </Text>
            </div>
          ) : null}

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this account</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="The business">
            <Field>
              <FieldLabel>Company name</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={nameError && touched ? 'error' : 'module'}
                    value={draft.companyName}
                    placeholder="Rivera Fabrication"
                    onChange={(event) => {
                      set('companyName', event.target.value);
                    }}
                  />
                }
              />
              {nameError && touched ? <FieldStatus status="error">{nameError}</FieldStatus> : null}
            </Field>

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Website</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color={websiteError && touched ? 'error' : 'module'}
                      value={draft.website}
                      placeholder="https://rivera.example"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        set('website', event.target.value);
                      }}
                    />
                  }
                />
                {websiteError && touched ? (
                  <FieldStatus status="error">{websiteError}</FieldStatus>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Tax number</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.taxId}
                      placeholder="Optional"
                      autoComplete="off"
                      onChange={(event) => {
                        set('taxId', event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Their VAT or tax registration number, if you need it on documents.
                </FieldDescription>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Trading terms"
            description="What this business is allowed and what it pays."
          >
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                color="module"
                aria-label="Account status"
                value={draft.status}
                items={Object.fromEntries(
                  ACCOUNT_STATUSES.map((s) => [s, accountStatusMeta(s).label])
                )}
                onValueChange={(next) => {
                  set('status', next as B2BAccountStatus);
                }}
              />
              <FieldDescription>{meta.description}</FieldDescription>
            </Field>

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Credit limit</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex max-w-[12rem] items-center gap-2">
                      <Text as="span" className="text-lg">
                        $
                      </Text>
                      <Input
                        color={creditError && touched ? 'error' : 'module'}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={draft.creditLimit}
                        placeholder="0.00"
                        onChange={(event) => {
                          set('creditLimit', numberOrEmpty(event.target.value));
                        }}
                      />
                    </div>
                  }
                />
                {creditError && touched ? (
                  <FieldStatus status="error">{creditError}</FieldStatus>
                ) : (
                  <FieldDescription>
                    The most they can owe you on account at once. Leave blank for none.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel>Discount</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex max-w-[10rem] items-center gap-2">
                      <Input
                        color={discountError && touched ? 'error' : 'module'}
                        type="number"
                        min={0}
                        max={100}
                        inputMode="decimal"
                        value={draft.discountPercent}
                        placeholder="0"
                        onChange={(event) => {
                          set('discountPercent', numberOrEmpty(event.target.value));
                        }}
                      />
                      <Text as="span" className="text-lg">
                        %
                      </Text>
                    </div>
                  }
                />
                {discountError && touched ? (
                  <FieldStatus status="error">{discountError}</FieldStatus>
                ) : (
                  <FieldDescription>
                    Taken off your normal prices for this account.
                  </FieldDescription>
                )}
              </Field>
            </div>

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Payment terms</FieldLabel>
                <Select
                  color="module"
                  aria-label="Payment terms"
                  value={draft.paymentTerms}
                  items={{
                    '': 'No agreed terms',
                    ...Object.fromEntries(PAYMENT_TERMS.map((t) => [t.value, t.label])),
                  }}
                  onValueChange={(next) => {
                    set('paymentTerms', next as string);
                  }}
                />
                <FieldDescription>
                  How long they have to pay after you invoice them.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Price tier</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.pricingTier}
                      placeholder="Optional"
                      onChange={(event) => {
                        set('pricingTier', event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  A named group your price lists can point at, if you use them.
                </FieldDescription>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Your side of it">
            <Field>
              <FieldLabel>Looked after by</FieldLabel>
              <Select
                color="module"
                aria-label="Which team member looks after this account"
                value={draft.assignedRepId}
                items={repItems}
                onValueChange={(next) => {
                  set('assignedRepId', next as string);
                }}
              />
              <FieldDescription>
                The person on your team who owns this relationship.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Fleet size</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-[10rem]">
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={draft.fleetSize}
                      placeholder="Optional"
                      onChange={(event) => {
                        set('fleetSize', numberOrEmpty(event.target.value));
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                If this business runs a fleet, how many vehicles or machines. Leave blank if it does
                not apply.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Labels</FieldLabel>
              <FieldControl
                render={
                  <TagInput
                    color="module"
                    value={draft.tags}
                    placeholder="Type a label and press Enter"
                    aria-label="Labels"
                    onValueChange={(next) => {
                      set('tags', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                Your own words for grouping accounts. Letters, numbers, - and _ only.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Notes</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={3}
                    value={draft.notes}
                    placeholder="Anything worth remembering about this account — only your team sees it."
                    onChange={(event) => {
                      set('notes', event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>

          {!isNew && account ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">
                {canDelete
                  ? 'Removing takes this account out of your lists. Its history is kept.'
                  : 'Only an owner or admin can remove an account.'}
              </Text>
              {canDelete ? (
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
                  Remove this account
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
