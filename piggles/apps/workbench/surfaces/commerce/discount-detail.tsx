'use client';

// One discount — create it, then manage it.
//
// Create and manage are the same surface: `{ id: 'new' }` builds it, `{ id }`
// manages it. A discount is one of two things, chosen with a single switch and
// changeable at any time: a CODE a shopper types, or an AUTOMATIC saving that
// applies on its own.
//
// The form is split by what it asks about — ./discount-form-offer (name, code,
// saving), ./discount-applies-to (which products it covers) and
// ./discount-form-limits (who, when, how often) — over the shared draft in
// ./discount-draft. Writes live in ./discount-editor-writes and the switch-on /
// retire pair in ./discount-lifecycle.

import { useEffect, useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Badge, Button, Card, Text } from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { SiteScopeField } from '../../components/site-scope-field';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { AppliesToField } from './discount-applies-to';
import { CREATABLE_TYPES, emptyDraft, fieldErrors, toDraft, type Draft } from './discount-draft';
import { useDiscountWrites } from './discount-editor-writes';
import { DiscountLimitFields } from './discount-form-limits';
import { DiscountOfferFields } from './discount-form-offer';
import { DiscountLifecycle } from './discount-lifecycle';
import { DiscountNotices } from './discount-notices';
import { discountState, useDiscount, type Discount } from './discounts-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function DiscountDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <DiscountEditor ctx={ctx} id="new" />
  ) : (
    <DiscountLoader ctx={ctx} id={id} />
  );
}

function DiscountLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: discount,
    isPending,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useDiscount(id);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            title="Could not load this discount"
            description="This is a problem reaching the server, or the discount has been retired. Nothing has been changed."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !discount) return <PaneWaiting />;

  return (
    <DiscountEditor
      ctx={ctx}
      id={id}
      discount={discount}
      isFetching={isFetching}
      updatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

function DiscountEditor({
  ctx,
  id,
  discount,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  id: string;
  discount?: Discount;
  /** Only the saved-discount state has a query behind it; "new" has none. */
  isFetching?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
}) {
  const isNew = id === 'new';

  const saved = useMemo(() => (discount ? toDraft(discount) : emptyDraft()), [discount]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New discount' : (discount?.name ?? 'Discount'));
  }, [ctx, isNew, discount]);

  const writes = useDiscountWrites(ctx, id, discount, () => {
    setTouched(false);
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = fieldErrors(draft);
  const blocked = errors.name ?? errors.code ?? errors.percent ?? errors.amount;

  useDirtySource(
    dirty && !writes.created,
    isNew
      ? 'This discount has not been created yet. Close anyway?'
      : 'This discount has unsaved changes. Close anyway?'
  );

  const state = discount ? discountState(discount) : null;
  const canCreateType = CREATABLE_TYPES.includes(draft.type);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Discount actions"
        status={
          <>
            {state ? (
              <Badge color={state.tone} variant="soft" size="sm">
                {state.label}
              </Badge>
            ) : null}
            {discount && discount.usageCount > 0 ? (
              <Text as="span" className="hidden shrink-0 text-sm @md:inline">
                Used {discount.usageCount === 1 ? 'once' : `${String(discount.usageCount)} times`}
              </Text>
            ) : null}
          </>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            loading={writes.saving}
            disabled={Boolean(blocked) || (!isNew && !dirty)}
            onClick={() => {
              if (!blocked) writes.save(draft);
            }}
          >
            {isNew ? 'Create discount' : 'Save'}
          </Button>
        }
        refresh={
          onRefresh ? (
            <RefreshButton
              isFetching={isFetching ?? false}
              updatedAt={updatedAt}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <DiscountNotices isNew={isNew} failure={writes.failure} type={draft.type} />

          <DiscountOfferFields
            draft={draft}
            set={set}
            touched={touched}
            nameError={errors.name}
            codeError={errors.code}
            percentError={errors.percent}
            amountError={errors.amount}
            canCreateType={canCreateType}
          />

          <AppliesToField
            value={draft.collectionIds}
            onChange={(next) => {
              set('collectionIds', next);
            }}
          />

          <DiscountLimitFields draft={draft} set={set} />

          <SiteScopeField
            value={draft.propertyIds}
            onChange={(next) => {
              set('propertyIds', next);
            }}
            title="Which of your sites the offer runs on"
            description="You run more than one website. Keep an offer to the business it was meant for, and the code will not work at the other one's checkout."
            everyLabel="Run it on every site"
          />

          {!isNew && discount ? (
            <DiscountLifecycle
              discount={discount}
              activating={writes.activating}
              retiring={writes.retiring}
              onActivate={writes.activate}
              onRetire={() => {
                void writes.retire();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
