'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Badge,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  ModuleProvider,
  statusTone,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createPriceListAction } from '../../pricing-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';
import type { TargetOption } from '../_lib/targeting-options';

// New-price-list form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// A price list has a natural running summary (name, scope, currency, priority,
// status), so it passes a live `summary` and is listed in SUMMARY_CREATE_TYPES
// (detail-registry) — the chrome widens the modal and the F-frame splits into
// form + summary, instead of a lone form floating in a narrow dialog. The
// summary fills the right column when wide and stacks below the fields in the
// narrow drawer, automatically.
//
// Price lists DO have a detail view, so create flows into it: on success the
// overlay swaps its token to the new record's detail (preserving drawer vs
// modal); the page navigates to the record. Targeting can be set here or
// changed later; per-variant entries are only managed from the detail page.

const CHANNELS = ['storefront', 'b2b_portal', 'admin', 'subscription'] as const;
type ChannelValue = (typeof CHANNELS)[number];

// Human labels for the channel scope — used identically in the select and the
// live summary so "applies to" reads in plain language, never raw snake_case.
const CHANNEL_LABELS: Record<ChannelValue, string> = {
  storefront: 'Storefront',
  b2b_portal: 'B2B portal',
  admin: 'Admin',
  subscription: 'Subscription',
};

type TargetType = 'none' | 'b2b_account' | 'segment';

interface PriceListCreateFormProps {
  surface: 'page' | 'overlay';
  b2bAccounts: TargetOption[];
  segments: TargetOption[];
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function PriceListCreateForm({ surface, b2bAccounts, segments }: PriceListCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [channel, setChannel] = React.useState('');
  const [priority, setPriority] = React.useState('0');
  const [targetType, setTargetType] = React.useState<TargetType>('none');
  const [b2bAccountId, setB2bAccountId] = React.useState('');
  const [customerSegmentId, setCustomerSegmentId] = React.useState('');

  // Field validation. `currency` carries no client rule but is validated-tracked
  // so a server-side currency error maps onto its field.
  const values = { name, currency, b2bAccountId, customerSegmentId };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    b2bAccountId: (val) =>
      targetType === 'b2b_account' && String(val).trim() === '' ? 'Pick a B2B account.' : null,
    customerSegmentId: (val) =>
      targetType === 'segment' && String(val).trim() === '' ? 'Pick a customer segment.' : null,
  });

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    description.trim() !== '' ||
    currency !== 'USD' ||
    channel !== '' ||
    priority !== '0' ||
    targetType !== 'none';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'price list' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created price list isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/pricing');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `price-list:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/pricing/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      currency: (currency.trim() || 'USD').toUpperCase(),
      channel: channel === '' ? undefined : channel,
      priority: Number(priority.trim() || '0') || 0,
      b2bAccountId: targetType === 'b2b_account' ? b2bAccountId : undefined,
      customerSegmentId: targetType === 'segment' ? customerSegmentId : undefined,
    };
    startTransition(async () => {
      const result = await createPriceListAction(input);
      if (!result.ok) {
        if (result.error.details?.length) {
          v.setServerErrors(
            Object.fromEntries(result.error.details.map((d) => [d.field, d.message]))
          );
        } else {
          setError(result.error.message);
        }
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New price list"
        backLabel="Pricing"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="price-list" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={surface === 'overlay' ? overlayActionsTarget : undefined}
        steps={STEPS}
        current={0}
        onCancel={cancel}
        summary={
          <PriceListDraftSummary
            name={name}
            channel={channel}
            currency={currency}
            priority={priority}
            targetType={targetType}
            targetLabel={
              targetType === 'b2b_account'
                ? (b2bAccounts.find((a) => a.id === b2bAccountId)?.label ?? null)
                : targetType === 'segment'
                  ? (segments.find((s) => s.id === customerSegmentId)?.label ?? null)
                  : null
            }
          />
        }
      >
        <SurfaceStep
          header={{
            title: 'Price list basics',
            supporting:
              'Name the list and set where it applies. Per-variant prices come next, on the detail page.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create price list',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <Field {...v.field('name')}>
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fleet wholesale"
                    {...v.control('name')}
                  />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <FieldControl
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    render={<Textarea rows={3} />}
                  />
                </Field>
                <div className="flex flex-row flex-wrap gap-3">
                  <Field {...v.field('currency')} className="w-28">
                    <FieldLabel>Currency</FieldLabel>
                    <FieldControl
                      name="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                      {...v.control('currency')}
                    />
                  </Field>
                  <Field className="min-w-[11rem] flex-1">
                    <FieldLabel>Channel</FieldLabel>
                    <FieldControl
                      name="channel"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      render={
                        <NativeSelect>
                          <option value="">All channels</option>
                          {CHANNELS.map((c) => (
                            <option key={c} value={c}>
                              {CHANNEL_LABELS[c]}
                            </option>
                          ))}
                        </NativeSelect>
                      }
                    />
                  </Field>
                  <Field className="w-28">
                    <FieldLabel>Priority</FieldLabel>
                    <FieldControl
                      name="priority"
                      type="number"
                      step="1"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-row flex-wrap gap-3">
                  <Field className="min-w-[11rem] flex-1">
                    <FieldLabel>Targeting</FieldLabel>
                    <FieldControl
                      name="targetType"
                      value={targetType}
                      onChange={(e) => {
                        const next = e.target.value as TargetType;
                        setTargetType(next);
                        if (next !== 'b2b_account') setB2bAccountId('');
                        if (next !== 'segment') setCustomerSegmentId('');
                      }}
                      render={
                        <NativeSelect>
                          <option value="none">All customers on this channel</option>
                          <option value="b2b_account">One B2B account</option>
                          <option value="segment">One customer segment</option>
                        </NativeSelect>
                      }
                    />
                  </Field>
                  {targetType === 'b2b_account' && (
                    <Field {...v.field('b2bAccountId')} className="min-w-[14rem] flex-1">
                      <FieldLabel required>B2B account</FieldLabel>
                      <FieldControl
                        name="b2bAccountId"
                        value={b2bAccountId}
                        onChange={(e) => setB2bAccountId(e.target.value)}
                        {...v.control('b2bAccountId')}
                        render={
                          <NativeSelect>
                            <option value="">— pick —</option>
                            {b2bAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </NativeSelect>
                        }
                      />
                    </Field>
                  )}
                  {targetType === 'segment' && (
                    <Field {...v.field('customerSegmentId')} className="min-w-[14rem] flex-1">
                      <FieldLabel required>Customer segment</FieldLabel>
                      <FieldControl
                        name="customerSegmentId"
                        value={customerSegmentId}
                        onChange={(e) => setCustomerSegmentId(e.target.value)}
                        {...v.control('customerSegmentId')}
                        render={
                          <NativeSelect>
                            <option value="">— pick —</option>
                            {segments.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </NativeSelect>
                        }
                      />
                    </Field>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

// The live draft summary aside — fills the right column in the wide modal and
// stacks as a card in the narrow drawer (the frame switches automatically).
// Mirrors form state so the list's scope takes shape as it's typed; holds no
// inputs and no primary action (docs/86 §2).
function PriceListDraftSummary({
  name,
  channel,
  currency,
  priority,
  targetType,
  targetLabel,
}: {
  name: string;
  channel: string;
  currency: string;
  priority: string;
  targetType: TargetType;
  targetLabel: string | null;
}) {
  return (
    <SurfaceSummary
      title="New price list"
      footer={
        // Status is its own semantic axis, not the module hue — statusTone('draft')
        // resolves to warning, matching the list's pills everywhere (DESIGN.md
        // Semantic-Status Rule).
        <Badge color={statusTone('draft')} variant="soft" size="sm">
          Draft — activate after adding entries
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Name" value={name.trim() || 'Untitled price list'} />
      <SurfaceSummaryRow
        label="Applies to"
        value={
          channel === '' ? 'All channels' : (CHANNEL_LABELS[channel as ChannelValue] ?? channel)
        }
      />
      <SurfaceSummaryRow label="Currency" value={(currency.trim() || 'USD').toUpperCase()} />
      <SurfaceSummaryRow label="Priority" value={priority.trim() || '0'} />
      <SurfaceSummaryRow
        label="Targeting"
        value={
          targetType === 'none'
            ? 'Everyone'
            : (targetLabel ?? (targetType === 'b2b_account' ? 'B2B account' : 'Segment'))
        }
      />
      <SurfaceSummaryDivider />
      <p className="text-base-content text-sm">
        Per-variant prices are set on the detail page after the list exists.
      </p>
    </SurfaceSummary>
  );
}
