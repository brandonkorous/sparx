'use client';

// The full line editor.
//
// The row itself keeps only the three fields a line almost always needs
// (description, qty, price). Everything else it CAN be — what kind of charge,
// a linked product, cost-plus-markup pricing, a discount, tax — lives here.
//
// Layout rule, and the thing an earlier version got wrong: EVERY field has ONE
// home that does not move. Cost sits in the numbers row whether the line is
// priced manually or by markup; there is a single `cost` state behind it. The
// only thing pricing mode changes is where the PRICE comes from — typed into
// the row, or computed by the markup row. Nothing relocates between modes.
//
// It edits a LOCAL copy and commits it to the invoice draft on Save; nothing
// touches the server until the invoice is saved. A markup line is priced here
// purely as a preview — the server re-prices authoritatively on save.
//
// State, validation and dirty tracking live in ./use-line-form.ts; this file is
// the presentation.

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useDirtySource } from '../../lib/workbench/dirty';
import { MoneyInput } from './money-input';
import { ProductPicker } from './product-picker';
import { ADHOC, METHOD_META, PASSTHROUGH, type MarkupRuleSummary } from './line-markup';
import { useLineForm, type LineTypeOption } from './use-line-form';
import { type DraftLine } from './totals';
import { formatMoney } from './types';
import type { BandMethod } from '@wizeworks/commerce-schemas';

// Re-exported so existing importers (invoice-editor, line-items) keep their
// `from './line-editor-modal'` path — the type just no longer lives here.
export type { LineTypeOption };

interface LineEditorModalProps {
  open: boolean;
  /** The line being edited, or null to add a fresh one. */
  line: DraftLine | null;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  currency: string;
  onClose: () => void;
  onSave: (line: DraftLine) => void;
}

export function LineEditorModal({
  open,
  line,
  lineTypes,
  markupRules,
  currency,
  onClose,
  onSave,
}: LineEditorModalProps) {
  const isEdit = Boolean(line?.id ?? line?.description);
  const form = useLineForm({ open, line, lineTypes, markupRules, onSave });
  const confirm = useConfirm();

  // Declares the in-progress line to the PANE, so closing the whole pane while
  // this modal holds a typed line asks first. Without it the pane reads its
  // header form only, reports clean, and the line dies with the tab — the
  // header can be untouched while a full line sits in here.
  useDirtySource(
    open && form.dirty,
    isEdit
      ? 'A line you were editing has changes you never saved. Close it anyway?'
      : 'You have a line you never added to this invoice. Close it anyway?'
  );

  // A line in progress is invisible to every guard in the app: it lives in this
  // form until Add/Save commits it, so it is not part of the invoice draft and
  // the PANE's dirty guard cannot see it. Escape used to discard it silently,
  // which made the reflex gesture the only lossy one. Every dismissal — Escape,
  // Cancel, an outside click — comes through here.
  async function requestClose() {
    if (form.dirty) {
      const ok = await confirm({
        title: isEdit ? 'Discard your changes?' : 'Discard this line?',
        description: isEdit
          ? 'Your changes to this line have not been added to the invoice yet.'
          : 'This line has not been added to the invoice yet.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        color: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  }

  return (
    // PaneScope portals the dialog into the pane that opened it. In a
    // multi-document interface a modal belongs to ONE document: editing a line
    // on invoice A must not black out invoice B in the pane beside it.
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void requestClose();
        }}
      >
        {/* The popup itself does not scroll — it is a flex column whose BODY
            scrolls, so the footer stays reachable (DialogFooter is static, not
            sticky). max-h is a percentage of the PANE, since a viewport-based
            cap would overflow the box the dialog is confined to. */}
        {/* `@container` is load-bearing: a PaneScope'd dialog portals to the
            pane HOST, which sits outside the `@container` on PANE_SHELL, so the
            two-column form below matched nothing and every field stacked. */}
        <DialogContent className="@container flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>{isEdit ? 'Edit line' : 'Add a line'}</DialogTitle>

          {/* px-1 keeps the focus ring clear of the scroll edge (overflow-y
              clips overflow-x); min-h-0 lets a flex child actually shrink. */}
          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
            {/* WHAT is being charged. Two columns once there's room (@lg, the
                named container step), stacked full-width in a narrow pane. */}
            <div className="grid gap-4 @lg:grid-cols-2">
              {lineTypes.length > 1 ? (
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <NativeSelect
                    color="module"
                    aria-label="Line type"
                    value={form.lineTypeId ?? ''}
                    onChange={(e) => {
                      form.selectType(e.target.value);
                    }}
                  >
                    {lineTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              <Field className={lineTypes.length > 1 ? undefined : '@lg:col-span-2'}>
                <FieldLabel>Product</FieldLabel>
                <ProductPicker
                  productId={form.productId}
                  variantId={form.variantId}
                  productLabel={form.productLabel}
                  currency={currency}
                  onPick={form.pickProduct}
                  onClear={form.clearProduct}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel required>Description</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={form.description}
                    placeholder="What is this charge?"
                    onChange={(e) => {
                      form.setDescription(e.target.value);
                    }}
                  />
                }
              />
              {form.show(form.errors.description) ? (
                <FieldStatus status="error">{form.errors.description}</FieldStatus>
              ) : null}
            </Field>

            {/* The numbers. Cost lives here in EVERY mode — it is a property of
                the line, not of the markup. Only Unit price is conditional: it
                is typed here when priced manually, and computed by the markup
                row below when not. */}
            <div className="flex flex-wrap items-start gap-3">
              <Field className="w-20">
                <FieldLabel required>Qty</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min="0"
                      step="0.001"
                      className="text-right tabular-nums"
                      value={form.quantity}
                      onChange={(e) => {
                        form.setQuantity(e.target.value);
                      }}
                    />
                  }
                />
                {form.show(form.errors.quantity) ? (
                  <FieldStatus status="error">{form.errors.quantity}</FieldStatus>
                ) : null}
              </Field>

              {form.markupMode ? null : (
                <Field className="w-28">
                  <FieldLabel>Unit price</FieldLabel>
                  <MoneyInput
                    size="md"
                    color="module"
                    value={form.unitPrice}
                    aria-label="Unit price"
                    onValueChange={form.setUnitPrice}
                  />
                  {form.show(form.errors.unitPrice) ? (
                    <FieldStatus status="error">{form.errors.unitPrice}</FieldStatus>
                  ) : null}
                </Field>
              )}

              <Field className="w-28">
                <FieldLabel required={form.markupMode}>Cost</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="text-right tabular-nums"
                      value={form.cost}
                      onChange={(e) => {
                        form.setCost(e.target.value);
                      }}
                    />
                  }
                />
                {form.show(form.errors.cost) ? (
                  <FieldStatus status="error">{form.errors.cost}</FieldStatus>
                ) : null}
              </Field>

              <Field className="w-28">
                <FieldLabel>Discount</FieldLabel>
                <MoneyInput
                  size="md"
                  color="module"
                  value={form.discountAmount}
                  aria-label="Line discount"
                  onValueChange={form.setDiscountAmount}
                />
              </Field>
            </div>

            {/* HOW the price is worked out — the markup directive and its terms,
                on one line, with the price it produces directly beneath. */}
            {form.markupMode ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start gap-3">
                  <Field className="min-w-[11rem] flex-1">
                    <FieldLabel>Markup</FieldLabel>
                    <NativeSelect
                      color="module"
                      aria-label="Markup source"
                      value={form.markup.source}
                      onChange={(e) => {
                        form.setMarkup((s) => ({ ...s, source: e.target.value }));
                      }}
                    >
                      {form.pricingMode === 'pass_through' ? (
                        <option value={PASSTHROUGH}>Pass through at cost</option>
                      ) : null}
                      {markupRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                      <option value={ADHOC}>Ad-hoc markup…</option>
                    </NativeSelect>
                  </Field>

                  {form.markup.source === ADHOC ? (
                    <>
                      <Field className="w-40">
                        <FieldLabel>Method</FieldLabel>
                        <NativeSelect
                          color="module"
                          aria-label="Markup method"
                          value={form.markup.method}
                          onChange={(e) => {
                            form.setMarkup((s) => ({ ...s, method: e.target.value as BandMethod }));
                          }}
                        >
                          <option value="percentage">Markup %</option>
                          <option value="margin_target">Target margin %</option>
                          <option value="multiplier">Multiplier ×</option>
                          <option value="flat">Add fixed $</option>
                        </NativeSelect>
                      </Field>
                      <Field className="w-24">
                        <FieldLabel>{METHOD_META[form.markup.method].label}</FieldLabel>
                        <FieldControl
                          render={
                            <Input
                              color="module"
                              type="number"
                              step="0.01"
                              className="text-right tabular-nums"
                              value={form.markup.value}
                              onChange={(e) => {
                                form.setMarkup((s) => ({ ...s, value: e.target.value }));
                              }}
                            />
                          }
                        />
                        {form.show(form.errors.markup) ? (
                          <FieldStatus status="error">{form.errors.markup}</FieldStatus>
                        ) : null}
                      </Field>
                    </>
                  ) : null}
                </div>

                {/* The price the markup produces. Named "Unit price" so it reads
                    as the same thing the line-item row shows — calculated here
                    rather than typed. Never faded; this is the money charged. */}
                {form.resolved.preview ? (
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Text as="span" className="text-sm">
                      Unit price
                    </Text>
                    <Text as="span" className="text-lg font-semibold tabular-nums">
                      {formatMoney(form.resolved.preview.priceCents / 100, currency)}
                    </Text>
                    <Text as="span" className="text-sm tabular-nums">
                      {form.resolved.preview.marginPct}% margin · {form.resolved.preview.markupPct}%
                      markup
                    </Text>
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={form.taxable}
                aria-label="Taxable"
                onChange={(e) => {
                  form.setTaxable(e.target.checked);
                }}
              />
              <Text as="span">Taxable</Text>
            </label>
          </div>

          <DialogFooter>
            {/* Not <DialogClose>: that dismisses on its own, and a discard this
                cheap to trigger has to go through the same question every other
                dismissal does. */}
            <Button
              color="neutral"
              variant="ghost"
              size="sm"
              onClick={() => {
                void requestClose();
              }}
            >
              Cancel
            </Button>
            <Button color="module" size="sm" onClick={form.submit}>
              {isEdit ? 'Save line' : 'Add line'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
