'use client';

// Trade pricing — what businesses pay for this product, as opposed to what the
// public pays.
//
// Registered under `b2b`, so `color="module"` resolves to the B2B hue rather
// than commerce orange. See the note in product-detail.tsx: `module` is the
// active-module bridge and is the ONLY correct spelling on a facet pane
// registered outside commerce.
//
// ── Why one pane and not four ────────────────────────────────────────────
//
// Four separate things decide what a trade customer is charged, and the server
// resolves them as a waterfall: a SIGNED AGREEMENT wins for as long as it runs,
// then a price set for one business, then a price set for a whole group on this
// product, then that group's blanket discount, then list. Read on their own, any
// one of them is a half-answer — a group discount of 15% means nothing if the
// business you are thinking of has a fixed price that overrides it. So the pane
// shows all four, in waterfall order, with every rule converted to CASH so they
// can actually be compared.
//
// This comment, the subtitle and the render order all used to say the reverse,
// and `pricingService.resolve` has always returned on the contract price before
// `resolve_b2b_price()` is consulted at all. See `trade-price-order.ts`, which
// now owns the sentence, and its test, which reads the charging code.
//
// ── Why the conversion matters more than it looks ────────────────────────
//
// The stored rules are a mix: some carry a fixed price in cents, some carry a
// percentage. A list of "15% off" beside "$42.00" beside "8% off" cannot be
// compared by eye, and comparing them is the entire reason anyone opens this.
// `tradeRulePriceCents` does the arithmetic once, in the data layer, against the
// variant's real list price.
//
// ── One create, no modal ─────────────────────────────────────────────────
//
// Adding a group price is three fields and it commits to the server, so it is an
// inline form in the pane rather than a dialog: a dialog here would be invisible
// to the dirty-tracking every other editor in the app participates in, for no
// gain. Editing an existing rule is deliberately NOT offered — a price is
// removed and re-added, because the two are the same number of actions and
// "edit" on a rule with a fixed-price/percentage XOR is a form that has to
// re-derive which half it is in.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { dayBoxProblem, dayEndUtc, todayIso, todayStartUtc } from '../../lib/today';
import { DayInput } from '../../components/day-input';
import { STRENGTH_ORDER_SENTENCE } from './trade-price-order';
import { faPlus, faServer, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { FollowingNotice, ProductScopeFallback, useProductScope } from './product-scope';
import {
  formatCents,
  productErrorMessage,
  tradeRulePriceCents,
  useAddAccountOverride,
  useAddContractPrice,
  useAddTierOverride,
  useRemoveAccountOverride,
  useRemoveContractPrice,
  useRemoveTierOverride,
  useTradeAccounts,
  useTradePricing,
  type Product,
  type TradePricing,
  type TradePricingVariant,
} from './products-data';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';

/**
 * This pane's subject as a lowercase noun phrase, for the middle of a sentence.
 * NOT the tab title: that is the catalog's, so the brand's rename reaches it.
 * See `ProductScopeOptions.noun`.
 */
const NOUN = 'the wholesale price';
/** Registry module for this pane, so the brand draws Trade's own picture rather
 *  than the generic one. */
const MODULE = 'b2b';

const MODE_ITEMS = {
  percent: 'A percentage off the normal price',
  fixed: 'A fixed price',
};

/** How much cheaper a rule is than list, as a phrase. Returned separately from
 *  the cash figure because "$42.00" alone does not say whether that is a good
 *  deal on a $45 product or a catastrophe on a $400 one. */
function savingLabel(ruleCents: number, listCents: number): string | null {
  if (listCents <= 0) return null;
  const off = Math.round(((listCents - ruleCents) / listCents) * 100);
  if (off === 0) return 'same as list price';
  if (off < 0) return `${String(Math.abs(off))}% ABOVE list price`;
  return `${String(off)}% below list price`;
}

/** One rule, rendered the same way wherever it came from. A row, not a table
 *  row: these lists are short, and a table here would invent columns (a "Type"
 *  column reading "Tier" beside a tier's own name) to justify its own width. */
function RuleRow({
  who,
  detail,
  variant,
  ruleCents,
  tone,
  badge,
  beaten,
  onRemove,
  removing,
}: {
  who: string;
  detail: string | null;
  variant: TradePricingVariant | undefined;
  ruleCents: number | null;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  badge: string;
  /** Why this rule is not the one being charged, when a stronger one covers
   *  the same business and the same version. Null when it IS the one. */
  beaten: string | null;
  onRemove: () => void;
  removing: boolean;
}) {
  const listCents = variant?.priceCents ?? 0;
  const saving = ruleCents !== null ? savingLabel(ruleCents, listCents) : null;

  return (
    <div className="border-base-300 flex flex-wrap items-start gap-x-3 gap-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      {/* `basis-48` is what makes the row fold instead of squeezing: below about
          360px the left column cannot shrink past 12rem, so the price block wraps
          to its own line rather than crushing "MARLOW-KNIT-XL-MOSS" into a column
          one syllable wide. */}
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" className="font-medium">
            {who}
          </Text>
          <Badge color={tone} variant="soft" size="sm">
            {badge}
          </Badge>
          {/* A figure on a screen is read as the figure being charged. This row
              carries a real price that nothing will ever bill, so it says so
              beside its own name rather than leaving the reader to work the
              waterfall out. [[feedback_never_present_absence_as_measurement]] */}
          {beaten ? (
            <Badge color="warning" variant="soft" size="sm">
              Not what they pay
            </Badge>
          ) : null}
        </div>
        {variant ? (
          <Text className="text-sm">
            {variant.title ?? variant.sku} · normally {formatCents(listCents, variant.currency)}
          </Text>
        ) : (
          <Text className="text-sm">This rule points at a version that no longer exists.</Text>
        )}
        {detail ? <Text className="text-sm">{detail}</Text> : null}
        {beaten ? <Text className="text-sm">{beaten}</Text> : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <Text as="span" className="text-lg font-semibold">
            {ruleCents === null ? '—' : formatCents(ruleCents, variant?.currency ?? 'USD')}
          </Text>
          {saving ? <Text className="text-sm">{saving}</Text> : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          shape="square"
          aria-label={`Remove the price for ${who}`}
          loading={removing}
          onClick={onRemove}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/**
 * Set a wholesale price for this product.
 *
 * ── WHY ONE FORM AND NOT THREE ───────────────────────────────────────────
 *
 * The pane renders four kinds of rule and, until issue 740, could CREATE one
 * of them. A group price had this form; a price for one business and a signed
 * agreement had a delete button each and no way to make one — the REST routes
 * existed and nothing in either console called them, so
 * `b2b_account_product_overrides` and `commerce_contract_prices` held 0 rows
 * across all 43 tenants on the machine.
 * [[feedback_screen_over_a_function_nobody_calls]]
 *
 * Three separate cards would have asked the same four questions three times.
 * So it is ONE form whose first question is who the price is for, and the rest
 * follow from that answer.
 *
 * ── AND WHY THE END DATE IS THE WHOLE OF THE THIRD ONE ───────────────────
 *
 * A price for one business and a signed agreement differ in the data by their
 * dates, and in a shop by whether anything was promised. So the form asks the
 * one question a shop owner can answer — "until when?" — and says what saying
 * so does. Blank is a standing price; a date makes it an agreement, which the
 * server then lets beat their group's price for as long as it runs.
 */
function SetAPrice({
  ctx,
  product,
  data,
  productId,
}: {
  ctx: SurfaceContext;
  product: Product;
  data: TradePricing;
  productId: string;
}) {
  const toast = useToast();
  const addTier = useAddTierOverride(productId);
  const addAccount = useAddAccountOverride(productId);
  const addContract = useAddContractPrice(productId);

  const liveTiers = data.tiers;
  // Only asked for once there is something on the product worth pricing, so a
  // product with no versions never pays for the list.
  const accounts = useTradeAccounts(data.variants.length > 0);
  const accountRows = useMemo(() => accounts.data ?? [], [accounts.data]);

  const tierItems = useMemo(
    () =>
      Object.fromEntries(
        liveTiers.map((tier) => [
          tier.id,
          `${tier.name}${
            tier.accountCount > 0
              ? ` · ${String(tier.accountCount)} ${tier.accountCount === 1 ? 'business' : 'businesses'}`
              : ' · nobody in it yet'
          }`,
        ])
      ),
    [liveTiers]
  );
  const accountItems = useMemo(
    () =>
      Object.fromEntries(
        accountRows.map((account) => [
          account.id,
          `${account.companyName}${account.tierName ? ` · ${account.tierName}` : ''}`,
        ])
      ),
    [accountRows]
  );
  const variantItems = useMemo(
    () =>
      Object.fromEntries(
        data.variants.map((variant) => [
          variant.id,
          `${variant.title ?? variant.sku} · ${formatCents(variant.priceCents, variant.currency)}`,
        ])
      ),
    [data.variants]
  );

  const hasGroups = liveTiers.length > 0;
  const hasBusinesses = accountRows.length > 0;
  const whoItems = useMemo(() => {
    const items: Record<string, string> = {};
    if (hasGroups) items.group = 'Everyone in a wholesale group';
    if (hasBusinesses) items.business = 'One business';
    return items;
  }, [hasGroups, hasBusinesses]);

  const [who, setWho] = useState<'group' | 'business'>('group');
  const [tierId, setTierId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [mode, setMode] = useState<'fixed' | 'percent'>('percent');
  const [amount, setAmount] = useState('');
  const [until, setUntil] = useState('');
  // The box's own half-typed state, which its `value` cannot express. See
  // `DayInput`.
  const [untilHalfTyped, setUntilHalfTyped] = useState(false);

  // The first row of each list, once it has arrived. Held here rather than in
  // `useState`'s initial value because the accounts arrive after the first
  // render and a picker that opens on a blank row makes the Save button look
  // broken for no reason the person can see.
  const chosenTier = tierId === '' ? (liveTiers[0]?.id ?? '') : tierId;
  const chosenAccount = accountId === '' ? (accountRows[0]?.id ?? '') : accountId;
  const chosenVariantId = variantId === '' ? (data.variants[0]?.id ?? '') : variantId;
  const chosenVariant = data.variants.find((v) => v.id === chosenVariantId);

  // "One business" cannot be the answer before there is a business, and neither
  // can "a group". Whichever is available wins, so the form is never sitting on
  // a choice that has no picker under it.
  const effectiveWho: 'group' | 'business' =
    who === 'business' && !hasBusinesses
      ? 'group'
      : who === 'group' && !hasGroups
        ? 'business'
        : who;

  // An agreement is a price, not a percentage: the server's contract price
  // carries `priceCents` and nothing else. So the end date is only offered once
  // a fixed price is being set for one business.
  const datable = effectiveWho === 'business' && mode === 'fixed';
  const endDate = datable ? until : '';
  const dateError = datable ? dayBoxProblem(until, untilHalfTyped) : null;

  const numeric = Number(amount);
  const valid =
    chosenVariantId !== '' &&
    (effectiveWho === 'group' ? chosenTier !== '' : chosenAccount !== '') &&
    amount.trim() !== '' &&
    Number.isFinite(numeric) &&
    numeric > 0 &&
    (mode === 'fixed' || numeric <= 100) &&
    dateError === null;

  const preview =
    valid && chosenVariant
      ? mode === 'fixed'
        ? Math.round(numeric * 100)
        : Math.round(chosenVariant.priceCents * (1 - numeric / 100))
      : null;

  const pending = addTier.isPending || addAccount.isPending || addContract.isPending;

  const failed = (error: unknown) => {
    toast.add({
      title: 'Could not set that price',
      description: productErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };
  const done = (title: string) => () => {
    setAmount('');
    setUntil('');
    setUntilHalfTyped(false);
    toast.add({ title, type: 'success' });
  };

  const submit = () => {
    if (!valid) return;
    const priceCents = mode === 'fixed' ? Math.round(numeric * 100) : undefined;
    const discountPercentage = mode === 'percent' ? numeric : undefined;

    if (effectiveWho === 'group') {
      addTier.mutate(
        { tierId: chosenTier, variantId: chosenVariantId, priceCents, discountPercentage },
        { onSuccess: done('Price set'), onError: failed }
      );
      return;
    }

    if (endDate !== '' && priceCents !== undefined) {
      const validTo = dayEndUtc(endDate);
      // `dateError` already refused anything that is not a calendar day, so a
      // null here would be a bug rather than a typo — and a silent fallback to
      // "no end date" would save an agreement that never ends.
      if (validTo === null) return;
      addContract.mutate(
        {
          companyId: chosenAccount,
          variantId: chosenVariantId,
          priceCents,
          validFrom: todayStartUtc(),
          validTo,
        },
        { onSuccess: done('Agreement recorded'), onError: failed }
      );
      return;
    }

    addAccount.mutate(
      { accountId: chosenAccount, variantId: chosenVariantId, priceCents, discountPercentage },
      { onSuccess: done('Price set'), onError: failed }
    );
  };

  if (data.variants.length === 0) {
    return (
      <FormSection title="Set a wholesale price">
        <Text className="text-sm">
          {product.title} has no versions to price yet. Add one on the product itself first: a
          wholesale price is set against a specific version, not the product as a whole.
        </Text>
      </FormSection>
    );
  }

  // Neither picker has anything in it, so there is nothing to fill in and two
  // places to go. This used to be a sentence telling her to "create one under
  // your trade customers" — a screen that is not called that, is not where a
  // group is made, and was not a link. Issue 740.
  if (!hasGroups && !hasBusinesses) {
    return (
      <FormSection title="Set a wholesale price">
        <Text className="text-sm">
          Nobody is set up to buy from you wholesale yet. A wholesale group is a set of businesses
          you charge the same way, like &ldquo;Trade&rdquo; or &ldquo;Stockists&rdquo;. Make a group
          first if several shops will pay the same, or add the business on its own if it is only
          one.
        </Text>
        <div className="flex flex-wrap gap-2">
          <Button
            color="module"
            size="sm"
            onClick={() => {
              ctx.open('b2b.pricing-tiers.list');
            }}
          >
            Open Wholesale groups
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              ctx.open('b2b.accounts.list');
            }}
          >
            Open Wholesale customers
          </Button>
        </div>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Set a wholesale price"
      description="What this product costs a business you sell to, instead of the normal price."
    >
      {/* One of the two is missing, so there is nothing to choose and the form
          says which one it is doing rather than asking a question with one
          answer. */}
      {hasGroups && hasBusinesses ? (
        <Field>
          <FieldLabel>Who gets it</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                value={effectiveWho}
                items={whoItems}
                onValueChange={(next) => {
                  setWho(next === 'business' ? 'business' : 'group');
                }}
                aria-label="Who gets it"
              />
            }
          />
        </Field>
      ) : null}

      {effectiveWho === 'group' ? (
        <Field>
          <FieldLabel>Which group</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                value={chosenTier}
                // `items` is not a convenience here: silica renders the
                // TRIGGER's selected label from this map, so a Select given
                // only children shows the raw stored value — a bare UUID
                // sitting where a group name belongs.
                items={tierItems}
                onValueChange={(next) => {
                  setTierId(String(next));
                }}
                aria-label="Which group"
              />
            }
          />
        </Field>
      ) : (
        <Field>
          <FieldLabel>Which business</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                value={chosenAccount}
                items={accountItems}
                onValueChange={(next) => {
                  setAccountId(String(next));
                }}
                aria-label="Which business"
              />
            }
          />
        </Field>
      )}

      {/* A one-version product has nothing to choose, and a control with one
          option is a question nobody asked. */}
      {data.variants.length > 1 ? (
        <Field>
          <FieldLabel>Which version</FieldLabel>
          <FieldControl
            render={
              <Select
                color="module"
                value={chosenVariantId}
                items={variantItems}
                onValueChange={(next) => {
                  setVariantId(String(next));
                }}
                aria-label="Which version"
              />
            }
          />
        </Field>
      ) : null}

      <Field>
        <FieldLabel>How the price is worked out</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              value={mode}
              items={MODE_ITEMS}
              onValueChange={(next) => {
                setMode(next === 'fixed' ? 'fixed' : 'percent');
              }}
              aria-label="How the price is worked out"
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>{mode === 'fixed' ? 'They pay' : 'Percentage off'}</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              inputMode="decimal"
              min={0}
              max={mode === 'percent' ? 100 : undefined}
              step={mode === 'fixed' ? 0.01 : 0.5}
              value={amount}
              placeholder={mode === 'fixed' ? '39.99' : '15'}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          {preview !== null && chosenVariant
            ? `They would pay ${formatCents(preview, chosenVariant.currency)} instead of ${formatCents(chosenVariant.priceCents, chosenVariant.currency)}.`
            : mode === 'fixed'
              ? 'The whole price they pay, not the amount taken off.'
              : 'Between 0 and 100.'}
        </FieldDescription>
      </Field>

      {datable ? (
        <Field>
          <FieldLabel>Until (optional)</FieldLabel>
          <FieldControl
            render={
              <div className="max-w-48">
                <DayInput
                  color="module"
                  min={todayIso()}
                  value={until}
                  aria-label="Until"
                  onValueChange={(next, halfTyped) => {
                    setUntil(next);
                    setUntilHalfTyped(halfTyped);
                  }}
                />
              </div>
            }
          />
          <FieldDescription>
            {dateError ??
              (until === ''
                ? 'Leave this empty and they simply get this price from now on.'
                : 'Putting a date on it records it as an agreement, starting today. While it runs it is what they pay, whatever else is set for them.')}
          </FieldDescription>
        </Field>
      ) : null}

      <div className="flex justify-end">
        <Button color="module" size="sm" disabled={!valid} loading={pending} onClick={submit}>
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          {endDate === '' ? 'Set this price' : 'Record this agreement'}
        </Button>
      </div>
    </FormSection>
  );
}
function TradePricingBody({
  ctx,
  product,
  data,
  productId,
}: {
  ctx: SurfaceContext;
  product: Product;
  data: TradePricing;
  productId: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const removeTier = useRemoveTierOverride(productId);
  const removeAccount = useRemoveAccountOverride(productId);
  const removeContract = useRemoveContractPrice(productId);

  const variantById = useMemo(
    () => new Map(data.variants.map((variant) => [variant.id, variant])),
    [data.variants]
  );

  /**
   * Every business-and-version already covered by a live agreement, with when
   * it ends.
   *
   * An agreement wins outright for as long as it runs, so a standing price on
   * the same pair is a number that will not be charged until the agreement
   * lapses. Held as a map rather than a set because the row needs the DATE: "not
   * what they pay" is a warning, and "not until April" is an answer.
   */
  const coveredByAgreement = useMemo(() => {
    const covered = new Map<string, string>();
    for (const contract of data.contractPrices) {
      if (!contract.active) continue;
      covered.set(
        `${contract.accountId}|${contract.variantId}`,
        contract.validTo
          ? `Not while the agreement above runs. This takes over on ${new Date(contract.validTo).toLocaleDateString(undefined, { dateStyle: 'medium' })}.`
          : 'Not while the agreement above runs, and that agreement has no end date.'
      );
    }
    return covered;
  }, [data.contractPrices]);

  // A tier scoped to `all` discounts this product without anybody having listed
  // it here, which is the difference between "nothing is set up" and "trade
  // customers already pay 15% less". Those tiers get their own card because
  // there is nothing on them to remove from this pane.
  const blanketTiers = data.tiers.filter(
    (tier) => tier.productScope === 'all' && tier.discountValue > 0
  );

  const confirmRemove = async (what: string, consequence: string): Promise<boolean> =>
    confirm({
      title: `Remove the price for ${what}?`,
      description: consequence,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });

  const failed = (error: unknown) => {
    toast.add({
      title: 'Could not remove that price',
      description: productErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const nothingSpecific =
    data.tierOverrides.length === 0 &&
    data.accountOverrides.length === 0 &&
    data.contractPrices.length === 0;

  return (
    <>
      <Text className="text-sm">
        What businesses you sell to pay for this, and how that compares with the price everyone else
        sees.
      </Text>

      {blanketTiers.length > 0 ? (
        <FormSection
          title="Groups that already get a discount on everything"
          description="These apply to this product automatically. Nothing here was set up for this product in particular."
        >
          <div className="flex flex-col gap-3">
            {blanketTiers.map((tier) => (
              <div
                key={tier.id}
                className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" className="font-medium">
                    {tier.name}
                  </Text>
                  <Text className="text-sm">
                    {tier.accountCount === 1
                      ? '1 business is in this group'
                      : `${String(tier.accountCount)} businesses are in this group`}
                    {tier.minOrderCents > 0
                      ? ` · only on orders over ${formatCents(tier.minOrderCents)}`
                      : ''}
                  </Text>
                </div>
                <Badge color="info" variant="soft">
                  {tier.discountType === 'percentage'
                    ? `${String(tier.discountValue)}% off everything`
                    : `${formatCents(Math.round(tier.discountValue * 100))} off everything`}
                </Badge>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}

      <FormSection title="Prices set for this product" description={STRENGTH_ORDER_SENTENCE}>
        {nothingSpecific ? (
          <Text className="text-sm">
            Nothing has been set for {product.title} in particular.{' '}
            {blanketTiers.length > 0
              ? 'The group discounts above still apply to it.'
              : 'Every business pays the normal price for it.'}
          </Text>
        ) : (
          <div className="flex flex-col gap-3">
            {data.contractPrices.map((rule) => {
              const variant = variantById.get(rule.variantId);
              const period = rule.validTo
                ? `Agreed until ${new Date(rule.validTo).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                : 'Agreed with no end date';
              return (
                <RuleRow
                  key={rule.id}
                  who={rule.accountName}
                  detail={[period, rule.notes].filter(Boolean).join(' · ')}
                  variant={variant}
                  ruleCents={rule.priceCents}
                  tone={rule.active ? 'success' : 'neutral'}
                  badge={rule.active ? 'Signed agreement' : 'Agreement expired'}
                  beaten={null}
                  removing={removeContract.isPending}
                  onRemove={() => {
                    void (async () => {
                      const ok = await confirmRemove(
                        `${rule.accountName} (signed agreement)`,
                        `The agreed price of ${formatCents(rule.priceCents)} stops applying and ${rule.accountName} falls back to their group's price. This does not cancel anything you signed on paper. It only stops the system charging it.`
                      );
                      if (!ok) return;
                      removeContract.mutate(rule.id, {
                        onSuccess: () => {
                          toast.add({ title: 'Agreed price removed', type: 'success' });
                        },
                        onError: failed,
                      });
                    })();
                  }}
                />
              );
            })}

            {data.accountOverrides.map((rule) => {
              const variant = variantById.get(rule.variantId ?? '');
              const limits = [
                rule.minOrderQty !== null ? `must buy at least ${String(rule.minOrderQty)}` : null,
                rule.maxOrderQty !== null ? `no more than ${String(rule.maxOrderQty)}` : null,
                rule.notes,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <RuleRow
                  key={rule.id}
                  who={rule.accountName}
                  detail={limits === '' ? null : limits}
                  variant={variant}
                  ruleCents={tradeRulePriceCents(rule, variant?.priceCents ?? 0)}
                  tone={rule.accountStatus === 'active' ? 'success' : 'warning'}
                  badge={
                    rule.accountStatus === 'active'
                      ? 'Just this business'
                      : `Just this business · account ${rule.accountStatus}`
                  }
                  beaten={
                    coveredByAgreement.get(`${rule.accountId}|${rule.variantId ?? ''}`) ?? null
                  }
                  removing={removeAccount.isPending}
                  onRemove={() => {
                    void (async () => {
                      const ok = await confirmRemove(
                        rule.accountName,
                        `${rule.accountName} goes back to whatever their group pays for ${product.title}, which may be the normal price. Orders they have already placed keep the price they were charged.`
                      );
                      if (!ok) return;
                      removeAccount.mutate(
                        { accountId: rule.accountId, overrideId: rule.id },
                        {
                          onSuccess: () => {
                            toast.add({ title: 'Price removed', type: 'success' });
                          },
                          onError: failed,
                        }
                      );
                    })();
                  }}
                />
              );
            })}

            {data.tierOverrides.map((rule) => {
              const variant = variantById.get(rule.variantId ?? '');
              return (
                <RuleRow
                  key={rule.id}
                  who={rule.tierName}
                  detail={
                    rule.tierDeleted
                      ? 'This group has been deleted, so this price no longer applies to anyone.'
                      : rule.notes
                  }
                  variant={variant}
                  ruleCents={tradeRulePriceCents(rule, variant?.priceCents ?? 0)}
                  tone={rule.tierDeleted ? 'neutral' : 'info'}
                  badge={rule.tierDeleted ? 'Group deleted' : 'Everyone in this group'}
                  beaten={null}
                  removing={removeTier.isPending}
                  onRemove={() => {
                    void (async () => {
                      const ok = await confirmRemove(
                        `everyone in ${rule.tierName}`,
                        `Every business in ${rule.tierName} goes back to paying that group's usual discount on ${product.title}, or the normal price if the group has none.`
                      );
                      if (!ok) return;
                      removeTier.mutate(
                        { tierId: rule.tierId, overrideId: rule.id },
                        {
                          onSuccess: () => {
                            toast.add({ title: 'Price removed', type: 'success' });
                          },
                          onError: failed,
                        }
                      );
                    })();
                  }}
                />
              );
            })}
          </div>
        )}
      </FormSection>

      <SetAPrice ctx={ctx} product={product} data={data} productId={productId} />
    </>
  );
}

export function ProductTradePricingSurface({ ctx }: { ctx: SurfaceContext }) {
  const scope = useProductScope(ctx, { noun: NOUN });
  const productId = scope.productId ?? 'new';
  const pricing = useTradePricing(productId);

  if (scope.state !== 'ready') {
    return <ProductScopeFallback ctx={ctx} scope={scope} noun={NOUN} module={MODULE} />;
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label={`${NOUN} actions`}
        status={
          scope.isFollowing ? (
            <Badge color="info" variant="soft" size="sm">
              Following
            </Badge>
          ) : null
        }
        refresh={
          <RefreshButton
            isFetching={pricing.isFetching}
            updatedAt={pricing.dataUpdatedAt}
            onRefresh={() => {
              void pricing.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <FollowingNotice scope={scope} />

          {/* A failed load REPLACES the body. Rendering the add form beside a
              list that could not be read would let someone set a second price
              on top of one they cannot see. */}
          {pricing.isError ? (
            <Card>
              <PaneLoadError
                module={MODULE}
                icon={<Icon glyph={faServer} className="size-6" aria-hidden />}
                title="Could not load trade pricing"
                description={productErrorMessage(
                  pricing.error,
                  'This is a problem reaching the server. Nothing about your prices has changed.'
                )}
                onRetry={() => {
                  void pricing.refetch();
                }}
              />
            </Card>
          ) : pricing.data ? (
            <TradePricingBody
              ctx={ctx}
              product={scope.product}
              data={pricing.data}
              productId={scope.productId}
            />
          ) : (
            /* Carded like the branches either side of it — the ready body is a
               stack of FormSections, each already a card. */
            <Card>
              <PaneWaiting module={MODULE} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
