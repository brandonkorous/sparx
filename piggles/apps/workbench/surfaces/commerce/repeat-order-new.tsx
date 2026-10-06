'use client';

// STARTING A REPEAT ORDER - a customer who wants the same thing again and
// again, written down once.
//
// ── Why this screen had to exist ─────────────────────────────────────────
//
// `subscriptionService.create` shipped with the models, the renewal worker, the
// dunning ladder and an MCP tool, and had NO other caller anywhere in the
// platform: no REST route, no checkout path, no console screen. So a repeat
// order could not come into existence unless somebody pointed an AI client at
// it, and the whole area - the list, the detail, the product panel, the "what
// repeat orders are worth" figures - sat over nothing. Three screens told the
// shop owner her customers could start one at checkout. None of them could.
// Issue 738. [[feedback_screen_over_a_function_nobody_calls]]
//
// ── Why it invoices rather than charges ──────────────────────────────────
//
// The other billing mode charges a card the customer vaulted themselves. A
// shop owner cannot vault one on their behalf, and a back-office screen that
// offered "charge their card" would be inviting her to take card details down
// the phone. So this one bills each delivery, which is what a shop that agreed
// a repeat order over the counter actually does.

import { shownInPlace } from '@wizeworks/query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  SearchInput,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faRepeat, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { afterPaneChange } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CustomerPicker, customerName, type CustomerSummary } from '../invoicing/customer-picker';
import { formatCents, formatDate } from './products-data';
import { orderErrorMessage } from './data';
import { useVariantSearch, type VariantChoice } from './bundles-data';
import { variantMatches } from './variant-search';
import { usePaymentConfig } from './providers-data';
import {
  useCustomerAddresses,
  useStartRepeatOrder,
  type CustomerAddressRow,
} from './subscriptions-data';
import {
  addressLine,
  cadenceOpener,
  eachTimeNote,
  firstDeliveryNote,
  paidNote,
  repeatOrderCheck,
  worthNote,
  type RepeatUnit,
} from './repeat-order-words';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/**
 * How often, in the words a shop owner uses for it.
 *
 * The list reads in the order a shop actually thinks: weeks and months are
 * almost every repeat order, a year is a membership, and days are the rare
 * one. It agrees with the number beside it, so "Every 2" is followed by "weeks"
 * and "Every 1" by "week" rather than by "week(s)".
 */
function unitLabels(count: number): Record<RepeatUnit, string> {
  const one = count === 1;
  return {
    week: one ? 'week' : 'weeks',
    month: one ? 'month' : 'months',
    year: one ? 'year' : 'years',
    day: one ? 'day' : 'days',
  };
}

/** One line being built. `price` is whole currency units, as typed. */
interface DraftLine {
  id: string;
  variantId: string;
  name: string;
  version: string | null;
  sku: string;
  quantity: number;
  price: string;
  currency: string;
}

/**
 * What tells this version apart, in her words rather than off a label.
 *
 * The same ladder the till uses (issue 182): the option values as she would say
 * them, else whatever the version is named, else nothing. A raw SKU is never the
 * answer here because the SKU is already on the row beside it.
 */
function versionOf(variant: VariantChoice): string | null {
  const options = variant.options.map((o) => o.value.trim()).filter(Boolean);
  if (options.length > 0) return options.join(' · ');
  const title = variant.title?.trim() ?? '';
  return title === '' ? null : title;
}

function lineFrom(variant: VariantChoice): DraftLine {
  return {
    id: `l_${crypto.randomUUID().slice(0, 8)}`,
    variantId: variant.id,
    name: variant.productTitle,
    version: versionOf(variant),
    sku: variant.sku,
    quantity: 1,
    // Carried from the catalog, not looked up again. The price is already on
    // the row she just clicked, and dropping it there is exactly the defect
    // issue 736 found on bundles. [[feedback_fetched_but_never_rendered]]
    price: (variant.priceCents / 100).toFixed(2),
    currency: variant.currency,
  };
}

function priceCentsOf(line: DraftLine): number {
  const value = Number(line.price);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/* -- Picking what goes out ------------------------------------------------ */

function VariantPicker({ onPick }: { onPick: (variant: VariantChoice) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  // The server searches what is typed, so a version past the first window is
  // as findable as the first (sparx persona P01, issue 069). The same rule runs
  // on the rows in hand, so the list narrows on the keystroke: the product's
  // name, its code, its version's name and its option values, word by word.
  const catalog = useVariantSearch(search);
  const isLoading = catalog.isPending;
  const isError = catalog.isError;
  const results = useMemo(
    () =>
      (catalog.data ?? [])
        .filter((v) => v.archivedAt === null && v.productStatus !== 'archived')
        .filter((v) => variantMatches(v, term))
        .slice(0, 12),
    [catalog.data, term]
  );

  if (isError) {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load what you sell</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server, not a problem with this repeat order.
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button size="sm" variant="outline" onClick={catalog.retry}>
            Try again
          </Button>
        </AlertActions>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search what you sell"
          placeholder="Search what you sell…"
          value={search}
          onValueChange={setSearch}
        />
      </div>
      {isLoading ? (
        <PaneWaiting label="Loading what you sell…" />
      ) : results.length === 0 && catalog.searching ? (
        // Never "nothing matches" while the answer is still on its way: it may
        // simply be past the rows already in hand.
        <PaneWaiting label="Looking through what you sell…" />
      ) : results.length === 0 ? (
        <Text className="text-sm">
          {term === ''
            ? 'Nothing set up to sell yet. Add a product first and it will show up here.'
            : `Nothing you sell matches “${term}”. Try fewer words, or the code off the box.`}
        </Text>
      ) : (
        <div className="border-base-300 max-h-64 overflow-y-auto rounded border p-1">
          {results.map((variant) => {
            const version = versionOf(variant);
            return (
              <button
                key={variant.id}
                type="button"
                className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-2 py-2 text-left"
                onClick={() => {
                  onPick(variant);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{variant.productTitle}</span>
                  <Text as="span" className="block text-sm">
                    {version ? `${version} · ${variant.sku}` : variant.sku}
                  </Text>
                </span>
                <Text as="span" className="shrink-0 text-sm tabular-nums">
                  {formatCents(variant.priceCents, variant.currency)}
                </Text>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraftLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  onChange: (next: DraftLine) => void;
  onRemove: () => void;
}) {
  const each = priceCentsOf(line) * line.quantity;
  return (
    <div className="border-base-300 flex flex-wrap items-end gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-[10rem] flex-1">
        <Text as="span" className="block font-medium">
          {line.name}
        </Text>
        <Text as="span" className="block text-sm">
          {line.version ? `${line.version} · ${line.sku}` : line.sku}
        </Text>
      </div>
      <label className="w-20">
        <span className="mb-1.5 block text-base font-medium">How many</span>
        <Input
          color="module"
          type="number"
          min="1"
          className="text-right tabular-nums"
          value={String(line.quantity)}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            onChange({ ...line, quantity: Number.isFinite(next) && next > 0 ? next : 1 });
          }}
        />
      </label>
      <label className="w-28">
        <span className="mb-1.5 block text-base font-medium">Price each</span>
        <Input
          color="module"
          inputMode="decimal"
          className="text-right tabular-nums"
          value={line.price}
          onFocus={(event) => {
            event.target.select();
          }}
          onChange={(event) => {
            onChange({ ...line, price: event.target.value });
          }}
        />
      </label>
      <span className="w-24 pb-2 text-right text-base font-medium tabular-nums">
        {formatCents(each, line.currency)}
      </span>
      <Button
        size="sm"
        shape="square"
        variant="ghost"
        color="danger"
        aria-label={`Take ${line.name} off this repeat order`}
        onClick={onRemove}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/* -- Where it goes -------------------------------------------------------- */

function DeliveryAddress({
  customer,
  addresses,
  isLoading,
  isError,
  chosenId,
  onChoose,
}: {
  customer: CustomerSummary | null;
  addresses: CustomerAddressRow[];
  isLoading: boolean;
  isError: boolean;
  chosenId: string | null;
  onChoose: (id: string) => void;
}) {
  if (!customer) {
    return <Text className="text-sm">Choose who this is for first.</Text>;
  }
  if (isLoading) return <PaneWaiting label="Loading their addresses…" />;
  if (isError) {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load their addresses</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Nothing about {customerName(customer)} has
            changed. Try again in a moment.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  if (addresses.length === 0) {
    return (
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>{customerName(customer)} has no address on file</AlertTitle>
          <AlertDescription>
            Every delivery needs somewhere to go. Add one on their customer record, then come back
            to this.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  const options: Record<string, string> = {};
  for (const address of addresses) {
    const where = addressLine(address);
    options[address.id] = address.label ? `${address.label}: ${where}` : where;
  }

  return (
    <Field>
      <FieldLabel>Where every delivery goes</FieldLabel>
      <Select
        color="module"
        aria-label="Where every delivery goes"
        value={chosenId ?? ''}
        items={options}
        onValueChange={(next) => {
          onChoose(String(next));
        }}
      />
      <FieldDescription>
        Every delivery goes here. You can change it later without starting again.
      </FieldDescription>
    </Field>
  );
}

/* -- The screen ----------------------------------------------------------- */

export function RepeatOrderNewSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const start = useStartRepeatOrder();
  const payments = usePaymentConfig();

  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [unit, setUnit] = useState<RepeatUnit>('month');
  const [count, setCount] = useState('1');
  const [addressId, setAddressId] = useState<string | null>(null);

  const addresses = useCustomerAddresses(customer?.id ?? '');
  // Memoized because the effect below depends on it: `?? []` mints a fresh
  // array every render, which would re-run the "pick their usual address"
  // effect on every keystroke anywhere on the form.
  const addressRows = useMemo(() => addresses.data?.items ?? [], [addresses.data]);

  // The one they already use, chosen for her. Picking the default is right far
  // more often than not, and she can change it in one click.
  useEffect(() => {
    if (addressId !== null) return;
    const preferred = addressRows.find((row) => row.isDefault) ?? addressRows[0];
    if (preferred) setAddressId(preferred.id);
  }, [addressRows, addressId]);

  const every = Number.parseInt(count, 10);
  const currency = lines[0]?.currency ?? 'USD';
  const money = (cents: number) => formatCents(cents, currency);
  const valued = useMemo(
    () => lines.map((line) => ({ unitPriceCents: priceCentsOf(line), quantity: line.quantity })),
    [lines]
  );

  const check = repeatOrderCheck({
    customerChosen: customer !== null,
    lineCount: lines.length,
    addressChosen: addressId !== null,
    count: every,
    everyLinePriced: lines.every((line) => Number.isFinite(Number(line.price))),
  });

  const started = customer !== null || lines.length > 0;
  useDirtySource(
    started && !start.isSuccess,
    'This repeat order has not been set up yet. Close anyway?'
  );

  const canSave = check.ok && !start.isPending && !start.isSuccess;

  const submit = () => {
    const address = addressRows.find((row) => row.id === addressId);
    if (!canSave || !customer || !address) return;
    start.mutate(
      {
        customerId: customer.id,
        currency,
        paymentProviderSlug: payments.data?.gatewayId ?? 'manual',
        intervalUnit: unit,
        intervalCount: every,
        lines: lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceCents: priceCentsOf(line),
        })),
        shippingAddress: {
          ...(address.recipientName ? { recipientName: address.recipientName } : {}),
          ...(address.company ? { company: address.company } : {}),
          line1: address.line1,
          ...(address.line2 ? { line2: address.line2 } : {}),
          city: address.city,
          ...(address.region ? { region: address.region } : {}),
          ...(address.postalCode ? { postalCode: address.postalCode } : {}),
          country: address.country,
          ...(address.phone ? { phone: address.phone } : {}),
        },
      },
      {
        onSuccess: (created) => {
          ctx.open('commerce.subscription.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({
              title: 'Repeat order set up',
              description: `First delivery ${formatDate(created.nextOccurrenceAt)}.`,
              type: 'success',
            });
          });
        },
        onError: shownInPlace,
      }
    );
  };

  const worth = worthNote({ lines: valued, unit, count: every, money });

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Repeat order actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            disabled={!canSave}
            loading={start.isPending}
            onClick={submit}
          >
            <Icon glyph={faRepeat} className="size-4" aria-hidden />
            Set it up
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {start.isError ? (
            <Alert color="error">
              <AlertContent>
                <AlertTitle>The repeat order was not set up</AlertTitle>
                <AlertDescription>
                  {orderErrorMessage(
                    start.error,
                    'Nothing was saved and nobody has been billed. Try again in a moment.'
                  )}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection
            title="Who it is for"
            description="A repeat order belongs to one customer. Every delivery goes onto their record, so what they have spent with you stays true."
          >
            <CustomerPicker
              value={customer?.id ?? null}
              onSelect={(next) => {
                setCustomer(next);
                setAddressId(null);
              }}
              onClear={() => {
                setCustomer(null);
                setAddressId(null);
              }}
              // A repeat order is usually agreed with somebody on the phone, so
              // the first one they ever place is also the first time they exist
              // (issue 745). Beside, not on top: this form is half filled in.
              onAddNew={(typed) => {
                ctx.open('crm.customer.detail', { id: 'new', name: typed }, { target: 'beside' });
              }}
            />
          </FormSection>

          <FormSection
            title="What they get each time"
            description="The same things go out on every delivery. Change the price if you have agreed a different one with them."
          >
            {lines.length > 0 ? (
              <div className="flex flex-col gap-3">
                {lines.map((line) => (
                  <DraftLineRow
                    key={line.id}
                    line={line}
                    onChange={(next) => {
                      setLines((current) =>
                        current.map((entry) => (entry.id === line.id ? next : entry))
                      );
                    }}
                    onRemove={() => {
                      setLines((current) => current.filter((entry) => entry.id !== line.id));
                    }}
                  />
                ))}
              </div>
            ) : null}

            <Text className="text-sm">{eachTimeNote(valued, money)}</Text>

            <VariantPicker
              onPick={(variant) => {
                setLines((current) => [...current, lineFrom(variant)]);
              }}
            />
          </FormSection>

          <FormSection
            title="How often"
            description="How much time goes by between one delivery and the next."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="w-24">
                <span className="mb-1.5 block text-base font-medium">Every</span>
                <Input
                  color="module"
                  type="number"
                  min="1"
                  className="text-right tabular-nums"
                  value={count}
                  onChange={(event) => {
                    setCount(event.target.value);
                  }}
                />
              </label>
              <Field className="min-w-40 flex-1">
                <FieldLabel>Of these</FieldLabel>
                <Select
                  color="module"
                  aria-label="Weeks, months or years between deliveries"
                  value={unit}
                  items={unitLabels(every)}
                  onValueChange={(next) => {
                    setUnit(next as RepeatUnit);
                  }}
                />
              </Field>
              <Badge color="module" variant="soft" size="sm" className="mb-2">
                {cadenceOpener(unit, every)}
              </Badge>
            </div>

            <Text className="text-sm">
              {firstDeliveryNote({
                startAt: new Date(),
                unit,
                count: Number.isFinite(every) && every > 0 ? every : 1,
                day: (date) => formatDate(date.toISOString()),
              })}
            </Text>

            {worth ? (
              <Alert color="module" variant="soft">
                <AlertContent>
                  <AlertDescription>{worth}</AlertDescription>
                </AlertContent>
              </Alert>
            ) : null}
          </FormSection>

          <FormSection title="Where it goes" description="The address every delivery is sent to.">
            <DeliveryAddress
              customer={customer}
              addresses={addressRows}
              isLoading={customer !== null && addresses.isPending}
              isError={addresses.isError}
              chosenId={addressId}
              onChoose={setAddressId}
            />
          </FormSection>

          <FormSection title="How it gets paid">
            <Text className="text-sm">{paidNote(customer ? customerName(customer) : null)}</Text>
          </FormSection>

          {check.problem ? <Text className="text-sm">{check.problem}</Text> : null}
        </div>
      </div>
    </div>
  );
}

export default RepeatOrderNewSurface;
