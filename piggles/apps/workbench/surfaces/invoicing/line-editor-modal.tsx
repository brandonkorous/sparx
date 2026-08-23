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
import { ProductPicker } from './product-picker';
import { type MarkupRuleSummary } from './line-markup';
import { LineEditorNumbers } from './line-editor-numbers';
import { useLineForm, type LineTypeOption } from './use-line-form';
import { type DraftLine } from './totals';

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

            <LineEditorNumbers form={form} markupRules={markupRules} currency={currency} />

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
