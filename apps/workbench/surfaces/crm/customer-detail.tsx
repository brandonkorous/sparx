'use client';

// One customer — add them, then manage them.
//
// Add and manage are the SAME surface: `{ id: 'new' }` builds a customer, `{ id }`
// manages one. A customer is one record with a `type` — prospect, retail or
// wholesale — changed by editing that field, never by moving to another list.
//
// This is an editable entity, so it shows its identity ONCE, as the name and
// email fields at the top — there is no second read-only heading repeating them.
// What the owner cannot change — what this person is worth and when they last
// bought — is Commerce's data seen from the customer's side, so it wears the
// Commerce hue via a nested ModuleScope, and it is read-only. Removing a
// customer is rare and irreversible, so it sits in a quiet row after the work
// rather than competing with the fields someone came to change.

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
  Switch,
  TagInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { MapPin, Trash2 } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useTeamRoster } from '../../lib/api/team';
import { useAccounts } from './accounts-data';
import {
  CUSTOMER_TYPES,
  customerErrorMessage,
  customerName,
  customerTypeMeta,
  formatMoney,
  useCreateCustomer,
  useCustomer,
  useCustomerAddresses,
  useDeleteCustomer,
  useUpdateCustomer,
  type Customer,
  type CustomerAddress,
  type CustomerInput,
  type CustomerType,
} from './customers-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const CONTACT_METHODS: Record<string, string> = {
  '': 'No preference',
  email: 'Email',
  phone: 'Phone call',
  sms: 'Text message',
};

/* ── Draft ──────────────────────────────────────────────────────────────── */

interface Draft {
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  type: CustomerType;
  email: string;
  phone: string;
  preferredContactMethod: string;
  doNotContact: boolean;
  assignedRepId: string;
  b2bAccountId: string;
  tags: string[];
}

function emptyDraft(): Draft {
  return {
    firstName: '',
    lastName: '',
    company: '',
    jobTitle: '',
    type: 'prospect',
    email: '',
    phone: '',
    preferredContactMethod: '',
    doNotContact: false,
    assignedRepId: '',
    b2bAccountId: '',
    tags: [],
  };
}

function toDraft(c: Customer): Draft {
  return {
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    company: c.company ?? '',
    jobTitle: c.jobTitle ?? '',
    type: c.type,
    email: c.email ?? '',
    phone: c.phone ?? '',
    preferredContactMethod: c.preferredContactMethod ?? '',
    doNotContact: c.doNotContact,
    assignedRepId: c.assignedRepId ?? '',
    b2bAccountId: c.b2bAccountId ?? '',
    tags: c.tags,
  };
}

const trimOrNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ── Surface ────────────────────────────────────────────────────────────── */

export function CustomerDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <CustomerEditor ctx={ctx} id="new" />
  ) : (
    <CustomerLoader ctx={ctx} id={id} />
  );
}

function CustomerLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: customer, isPending, isError, refetch } = useCustomer(id);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this customer</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the customer has been removed. Nothing has
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

  if (isPending || !customer) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <CustomerEditor ctx={ctx} id={id} customer={customer} />;
}

function CustomerEditor({
  ctx,
  id,
  customer,
}: {
  ctx: SurfaceContext;
  id: string;
  customer?: Customer;
}) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateCustomer();
  const update = useUpdateCustomer(id);
  const remove = useDeleteCustomer(id);

  const { members } = useTeamRoster();
  const { data: accounts } = useAccounts();

  const saved = useMemo(() => (customer ? toDraft(customer) : emptyDraft()), [customer]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New customer' : customer ? customerName(customer) : 'Customer');
  }, [ctx, isNew, customer]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = create.isPending || update.isPending;

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This customer has not been added yet. Close anyway?'
      : 'This customer has unsaved changes. Close anyway?'
  );

  /* ── Options ──────────────────────────────────────────────────────────── */

  // Reps are keyed by staff USER id (what a customer's assignedRepId points at),
  // not the team-membership id. A saved rep who has since left the team is no
  // longer in the roster, so a placeholder keeps the Select from showing a blank.
  const repItems = useMemo(() => {
    const items: Record<string, string> = { '': 'No one assigned' };
    for (const m of members) items[m.userId] = m.name ?? m.email;
    if (draft.assignedRepId && !items[draft.assignedRepId]) {
      items[draft.assignedRepId] = 'A former team member';
    }
    return items;
  }, [members, draft.assignedRepId]);

  const accountItems = useMemo(() => {
    const items: Record<string, string> = { '': 'Not linked to an account' };
    for (const a of accounts?.items ?? []) items[a.id] = a.companyName;
    if (draft.b2bAccountId && !items[draft.b2bAccountId]) {
      items[draft.b2bAccountId] = 'A removed account';
    }
    return items;
  }, [accounts, draft.b2bAccountId]);

  /* ── Validation ───────────────────────────────────────────────────────── */

  const hasIdentity =
    draft.firstName.trim() !== '' ||
    draft.lastName.trim() !== '' ||
    draft.company.trim() !== '' ||
    draft.email.trim() !== '';
  const nameError = hasIdentity
    ? null
    : 'Enter a name, company or email so you can find this person later.';
  const emailError =
    draft.email.trim() !== '' && !EMAIL_RE.test(draft.email.trim())
      ? 'Enter a valid email like name@example.com.'
      : null;
  const blocked = nameError ?? emailError;

  const failure =
    create.isError || update.isError
      ? customerErrorMessage(
          create.error ?? update.error,
          'Could not save this customer. Nothing was changed.'
        )
      : null;

  /* ── Build + submit ───────────────────────────────────────────────────── */

  const buildInput = (): CustomerInput => {
    const candidate: CustomerInput = {
      type: draft.type,
      email: trimOrNull(draft.email),
      phone: trimOrNull(draft.phone),
      firstName: trimOrNull(draft.firstName),
      lastName: trimOrNull(draft.lastName),
      company: trimOrNull(draft.company),
      jobTitle: trimOrNull(draft.jobTitle),
      // A wholesale link only means anything for a wholesale contact; clearing
      // the link when the kind changes keeps the record honest.
      b2bAccountId: draft.type === 'b2b' ? draft.b2bAccountId || null : null,
      assignedRepId: draft.assignedRepId || null,
      preferredContactMethod: draft.preferredContactMethod
        ? (draft.preferredContactMethod as 'email' | 'phone' | 'sms')
        : null,
      doNotContact: draft.doNotContact,
      tags: draft.tags,
    };
    return candidate;
  };

  const submit = () => {
    if (blocked) return;
    const input = buildInput();

    if (isNew) {
      create.mutate(input, {
        onSuccess: (created) => {
          ctx.open('crm.customer.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${customerName(created)} added`, type: 'success' });
          });
        },
      });
      return;
    }

    update.mutate(input, {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: 'Customer saved', type: 'success' });
      },
    });
  };

  const onDelete = async () => {
    if (!customer) return;
    const name = customerName(customer);
    const ok = await confirm({
      title: `Remove ${name}?`,
      description:
        'This takes the customer out of your lists. Their past orders and history are kept for your records, and you can add them again later. Nothing is emailed to them.',
      confirmLabel: 'Remove this customer',
      cancelLabel: 'Keep them',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${name} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this customer',
          description: customerErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const meta = customerTypeMeta(draft.type);
  const spent = customer ? Number(customer.totalSpent) : 0;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Customer actions">
        <Badge color={meta.color} variant="soft" size="sm">
          {meta.label}
        </Badge>
        {customer && customer.orderCount > 0 ? (
          <Text as="span" className="hidden shrink-0 text-sm @md:inline">
            {formatMoney(spent)} over{' '}
            {customer.orderCount === 1 ? '1 order' : `${String(customer.orderCount)} orders`}
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
          {isNew ? 'Add customer' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a customer
              </Heading>
              <Text>
                Everyone you sell to or keep in touch with lives here. Fill in what you know — a
                name or an email is enough to start.
              </Text>
            </div>
          ) : null}

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this customer</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="Who they are">
            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>First name</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color={nameError && touched ? 'error' : 'module'}
                      value={draft.firstName}
                      placeholder="Jamie"
                      onChange={(event) => {
                        set('firstName', event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Last name</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color={nameError && touched ? 'error' : 'module'}
                      value={draft.lastName}
                      placeholder="Rivera"
                      onChange={(event) => {
                        set('lastName', event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>
            {nameError && touched ? <FieldStatus status="error">{nameError}</FieldStatus> : null}

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Company</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.company}
                      placeholder="Rivera Fabrication"
                      onChange={(event) => {
                        set('company', event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Job title</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.jobTitle}
                      placeholder="Owner"
                      onChange={(event) => {
                        set('jobTitle', event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Kind of customer</FieldLabel>
              <Select
                color="module"
                aria-label="Kind of customer"
                value={draft.type}
                items={Object.fromEntries(
                  CUSTOMER_TYPES.map((t) => [t, customerTypeMeta(t).label])
                )}
                onValueChange={(next) => {
                  set('type', next as CustomerType);
                }}
              />
              <FieldDescription>{meta.description}</FieldDescription>
            </Field>
          </FormSection>

          <FormSection
            title="How to reach them"
            description="However you have it — none of this is required."
          >
            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color={emailError && touched ? 'error' : 'module'}
                      type="email"
                      value={draft.email}
                      placeholder="jamie@example.com"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        set('email', event.target.value);
                      }}
                    />
                  }
                />
                {emailError && touched ? (
                  <FieldStatus status="error">{emailError}</FieldStatus>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="tel"
                      value={draft.phone}
                      placeholder="(555) 010-2233"
                      autoComplete="off"
                      onChange={(event) => {
                        set('phone', event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Best way to reach them</FieldLabel>
              <Select
                color="module"
                aria-label="Best way to reach them"
                value={draft.preferredContactMethod}
                items={CONTACT_METHODS}
                onValueChange={(next) => {
                  set('preferredContactMethod', next as string);
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Do not send marketing</FieldLabel>
              <FieldControl
                render={
                  <Switch
                    color="module"
                    checked={draft.doNotContact}
                    onCheckedChange={(next: boolean) => {
                      set('doNotContact', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                {draft.doNotContact
                  ? 'They are left out of marketing emails. Order and account messages still reach them.'
                  : 'They may receive your marketing emails if they have opted in.'}
              </FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="Your side of it">
            <Field>
              <FieldLabel>Looked after by</FieldLabel>
              <Select
                color="module"
                aria-label="Which team member looks after this customer"
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

            {draft.type === 'b2b' ? (
              <Field>
                <FieldLabel>Wholesale account</FieldLabel>
                <Select
                  color="module"
                  aria-label="Which wholesale account this contact belongs to"
                  value={draft.b2bAccountId}
                  items={accountItems}
                  onValueChange={(next) => {
                    set('b2bAccountId', next as string);
                  }}
                />
                <FieldDescription>
                  The business this person buys on behalf of — they get its agreed prices and terms.
                </FieldDescription>
              </Field>
            ) : null}

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
                Your own words for grouping people — “vip”, “trade-show”, “needs-follow-up”.
                Letters, numbers, - and _ only.
              </FieldDescription>
            </Field>
          </FormSection>

          {!isNew && customer ? (
            <>
              <LifetimeSection customer={customer} />
              <AddressesSection id={id} />

              <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Text className="text-sm">
                  Removing takes this customer out of your lists. Their history is kept.
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
                  Remove this customer
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Lifetime signals (Commerce's data, seen from the customer's side) ────── */

function longDate(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function LifetimeSection({ customer }: { customer: Customer }) {
  const spent = Number(customer.totalSpent);
  const hasOrders = customer.orderCount > 0;

  return (
    // This is Commerce's data, not the CRM's, so it wears the Commerce hue — the
    // one signal that these figures come from Selling, not something you edit here.
    <ModuleScope module="commerce">
      <FormSection
        title="What they are worth"
        description="Totalled from their orders. This updates on its own — there is nothing to fill in."
      >
        <div className="grid gap-4 @sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Text className="text-sm">Total spent</Text>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(spent)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Text className="text-sm">Orders placed</Text>
            <div>
              <Badge color="module" variant="soft" size="lg">
                {customer.orderCount.toLocaleString()}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Text className="text-sm">First order</Text>
            <span className="text-base font-medium">
              {hasOrders ? longDate(customer.firstOrderAt) : 'No orders yet'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Text className="text-sm">Last order</Text>
            <span className="text-base font-medium">
              {hasOrders ? longDate(customer.lastOrderAt) : 'No orders yet'}
            </span>
          </div>
        </div>
      </FormSection>
    </ModuleScope>
  );
}

/* ── Addresses (read-only) ───────────────────────────────────────────────── */

function addressTypeLabel(type: string): string {
  if (type === 'shipping') return 'Delivery';
  if (type === 'billing') return 'Billing';
  return 'Delivery & billing';
}

function AddressBlock({ address }: { address: CustomerAddress }) {
  const lines = [
    address.recipientName,
    address.company,
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter((line): line is string => Boolean(line?.trim()));

  return (
    <div className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="neutral" variant="outline" size="sm">
          {addressTypeLabel(address.type)}
        </Badge>
        {address.label ? <Text className="text-sm font-semibold">{address.label}</Text> : null}
        {address.isDefault ? (
          <Badge color="success" variant="soft" size="sm">
            Default
          </Badge>
        ) : null}
      </div>
      <address className="text-sm not-italic">
        {lines.map((line, index) => (
          <span key={index} className="block">
            {line}
          </span>
        ))}
      </address>
      {address.phone ? <Text className="text-sm">{address.phone}</Text> : null}
    </div>
  );
}

function AddressesSection({ id }: { id: string }) {
  const { data: addresses, isPending, isError } = useCustomerAddresses(id);

  return (
    <FormSection
      title="Addresses"
      description="Where this customer's orders ship and bill to. Addresses are added on their orders."
    >
      {isError ? (
        <Text className="text-sm">Could not load addresses just now.</Text>
      ) : isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : (addresses?.length ?? 0) === 0 ? (
        <div className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <Text className="text-sm">No addresses on file for this customer yet.</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses?.map((address) => (
            <AddressBlock key={address.id} address={address} />
          ))}
        </div>
      )}
    </FormSection>
  );
}
