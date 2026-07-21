'use client';

// ONE PURCHASE ORDER — write it, place it with the supplier, then work it down
// as the goods arrive.
//
// ── Create and manage are ONE pane ────────────────────────────────────────
//
// A brand-new order and an existing draft are the same screen: `{id:'new'}` is it
// before the order exists, `{id}` after. Only a DRAFT can be edited — once placed,
// the order is locked and the numbers only move through Receiving — so the pane
// swaps from an editor into a read-only record of a real order the moment it is
// placed, with its lifecycle actions in the toolbar.
//
// ── One Save over many endpoints ──────────────────────────────────────────
//
// The whole draft — header and every line — is held locally and saved on one
// Save, with a leave-guard while there are unsaved edits. The data layer's saver
// reconciles that draft down to the individual add/update/remove calls the API
// exposes, so the pane behaves like every other editor rather than writing a line
// to the server on each keystroke.
//
// ── The line editor is a modal that commits to the DRAFT ──────────────────
//
// Adding or editing a line opens a dialog whose Save writes into the local draft,
// not the server — so the pane stays dirty on its behalf and nothing is committed
// until the order itself is saved. That is the one sanctioned use of a modal here.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Combobox,
  DateInput,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Table,
  Textarea,
  Text,
  useImperativeAlertDialog,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, useStockLocations } from './data';
import {
  buyingErrorMessage,
  isNotFound,
  useSupplierVariants,
  useSuppliers,
  useVariantLookup,
} from './suppliers-data';
import {
  formatDay,
  isEditable,
  isReceivable,
  outstandingUnits,
  purchaseOrderState,
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  useDeletePurchaseOrder,
  usePlacePurchaseOrder,
  usePurchaseOrder,
  useSavePurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderHeaderDraft,
  type PurchaseOrderLine,
  type PurchaseOrderLineDraft,
} from './purchase-orders-data';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

/* ── Money helpers ──────────────────────────────────────────────────────── */

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
function inputToCents(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/* ── Draft assembly ─────────────────────────────────────────────────────── */

interface Draft {
  header: PurchaseOrderHeaderDraft;
  lines: PurchaseOrderLineDraft[];
}

function emptyDraft(): Draft {
  return {
    header: {
      supplierId: '',
      warehouseId: '',
      currency: 'USD',
      paymentTerms: null,
      reference: null,
      expectedArrivalAt: null,
      shippingCents: 0,
      notes: null,
    },
    lines: [],
  };
}

function draftFromDetail(detail: PurchaseOrderDetail): Draft {
  return {
    header: {
      supplierId: detail.supplierId,
      warehouseId: detail.warehouseId,
      currency: detail.currency,
      paymentTerms: detail.paymentTerms,
      reference: detail.reference,
      expectedArrivalAt: detail.expectedArrivalAt,
      shippingCents: detail.shippingCents,
      notes: detail.notes,
    },
    lines: detail.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      variantSku: line.variantSku,
      productTitle: line.productTitle,
      description: line.description,
      supplierSku: line.supplierSku,
      quantityOrdered: line.quantityOrdered,
      unitCostCents: line.unitCostCents,
    })),
  };
}

function subtotalOf(lines: PurchaseOrderLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCostCents, 0);
}

/* ── The line editor (a modal committing to the draft) ──────────────────── */

interface EditingLine {
  /** The draft line being edited, or null when adding a fresh one. */
  line: PurchaseOrderLineDraft | null;
}

function LineEditor({
  supplierId,
  currency,
  editing,
  onClose,
  onSave,
}: {
  supplierId: string;
  currency: string;
  editing: EditingLine | null;
  onClose: () => void;
  onSave: (line: PurchaseOrderLineDraft) => void;
}) {
  const open = editing !== null;
  const existing = editing?.line ?? null;
  const isEdit = existing !== null;
  const confirm = useImperativeAlertDialog();

  const supplierVariants = useSupplierVariants(supplierId);
  const lookup = useVariantLookup();

  const [variant, setVariant] = useState<{
    variantId: string;
    variantSku: string | null;
    productTitle: string | null;
  } | null>(null);
  const [description, setDescription] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cost, setCost] = useState('');
  const [skuLookup, setSkuLookup] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Reset the form each time the dialog opens onto a (possibly different) line.
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setVariant({
        variantId: existing.variantId,
        variantSku: existing.variantSku,
        productTitle: existing.productTitle,
      });
      setDescription(existing.description ?? existing.productTitle ?? '');
      setSupplierSku(existing.supplierSku ?? '');
      setQuantity(String(existing.quantityOrdered));
      setCost(centsToInput(existing.unitCostCents));
    } else {
      setVariant(null);
      setDescription('');
      setSupplierSku('');
      setQuantity('1');
      setCost('');
    }
    setSkuLookup('');
    setLookupError(null);
  }, [open, existing]);

  const qty = Number.parseInt(quantity, 10);
  const costCents = inputToCents(cost);
  const valid = variant !== null && Number.isFinite(qty) && qty > 0 && costCents !== null;

  const dirty =
    variant !== null &&
    (!isEdit ||
      qty !== existing.quantityOrdered ||
      costCents !== existing.unitCostCents ||
      supplierSku.trim() !== (existing.supplierSku ?? '') ||
      description.trim() !== (existing.description ?? ''));

  useDirtySource(
    open && dirty,
    isEdit
      ? 'A line you were editing has changes you never saved. Discard them?'
      : 'You have a line you never added to this order. Discard it?'
  );

  const variantOptions = useMemo(
    () =>
      (supplierVariants.data ?? []).map((sv) => ({
        value: sv.variantId,
        label: sv.productTitle
          ? `${sv.productTitle}${sv.variantSku ? ` · ${sv.variantSku}` : ''}`
          : (sv.variantSku ?? 'Item'),
        sv,
      })),
    [supplierVariants.data]
  );

  const selectedOption = useMemo(
    () => variantOptions.find((option) => option.value === variant?.variantId) ?? null,
    [variantOptions, variant]
  );

  const pickSuggested = (option: (typeof variantOptions)[number] | null) => {
    if (!option) return;
    const sv = option.sv;
    setVariant({
      variantId: sv.variantId,
      variantSku: sv.variantSku,
      productTitle: sv.productTitle,
    });
    setDescription(sv.productTitle ?? sv.variantSku ?? '');
    if (sv.supplierSku) setSupplierSku(sv.supplierSku);
    if (sv.unitCostCents !== null && cost.trim() === '') setCost(centsToInput(sv.unitCostCents));
  };

  const findByCode = async () => {
    setLookupError(null);
    const code = skuLookup.trim();
    if (code === '') return;
    try {
      const found = await lookup.mutateAsync(code);
      setVariant({
        variantId: found.variantId,
        variantSku: found.sku,
        productTitle: found.productTitle,
      });
      setDescription(found.productTitle ?? found.sku);
      setSkuLookup('');
    } catch (err) {
      setLookupError(
        isNotFound(err)
          ? `No item in your catalog has the code "${code}".`
          : buyingErrorMessage(err, 'Could not look that code up.')
      );
    }
  };

  const submit = () => {
    if (!valid || variant === null || costCents === null) return;
    onSave({
      ...(existing?.id ? { id: existing.id } : {}),
      variantId: variant.variantId,
      variantSku: variant.variantSku,
      productTitle: variant.productTitle,
      description: description.trim() === '' ? (variant.productTitle ?? null) : description.trim(),
      supplierSku: supplierSku.trim() === '' ? null : supplierSku.trim(),
      quantityOrdered: qty,
      unitCostCents: costCents,
    });
    onClose();
  };

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: isEdit ? 'Discard your changes?' : 'Discard this line?',
        description: isEdit
          ? 'Your changes to this line have not been saved to the order yet.'
          : 'This line has not been added to the order yet.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        color: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  const lineTotal =
    variant && Number.isFinite(qty) && qty > 0 && costCents !== null ? qty * costCents : null;

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void requestClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>{isEdit ? 'Edit line' : 'Add a line'}</DialogTitle>

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
            {/* Choosing the item — only when adding. When editing, the item is
                fixed (changing it is a remove-and-add), shown as identity. */}
            {isEdit ? (
              <div className="border-base-300 flex flex-col gap-0.5 rounded-lg border p-3">
                <Text className="font-medium">{variant?.productTitle ?? 'Item'}</Text>
                <Text className="font-mono text-sm">{variant?.variantSku ?? 'No code'}</Text>
              </div>
            ) : (
              <>
                <Field>
                  <FieldLabel>Item you buy from this supplier</FieldLabel>
                  <Combobox
                    color="module"
                    items={variantOptions}
                    value={selectedOption}
                    disabled={supplierVariants.isLoading}
                    placeholder={
                      variantOptions.length === 0
                        ? 'Nothing recorded for this supplier yet'
                        : 'Search what you buy here…'
                    }
                    emptyMessage="No match. Try the product code below instead."
                    aria-label="Item"
                    clearable={false}
                    onValueChange={(next) => {
                      pickSuggested(next as (typeof variantOptions)[number] | null);
                    }}
                  />
                  <FieldDescription>
                    These are the items recorded against this supplier, with their price ready to
                    fill in.
                  </FieldDescription>
                </Field>

                <div className="flex flex-col gap-2">
                  <Field>
                    <FieldLabel>Or find any item by its code</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <FieldControl
                          render={
                            <Input
                              color="module"
                              size="sm"
                              value={skuLookup}
                              placeholder="Product code"
                              spellCheck={false}
                              onChange={(event) => {
                                setSkuLookup(event.target.value);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void findByCode();
                                }
                              }}
                            />
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        color="neutral"
                        disabled={skuLookup.trim() === ''}
                        loading={lookup.isPending}
                        onClick={() => {
                          void findByCode();
                        }}
                      >
                        Find
                      </Button>
                    </div>
                  </Field>
                  {lookupError ? (
                    <Alert color="danger" variant="soft">
                      <AlertContent>
                        <AlertDescription>{lookupError}</AlertDescription>
                      </AlertContent>
                    </Alert>
                  ) : null}
                  {variant && !selectedOption ? (
                    <Text className="text-sm">
                      Selected:{' '}
                      <span className="font-medium">
                        {variant.productTitle ?? variant.variantSku}
                      </span>
                    </Text>
                  ) : null}
                </div>
              </>
            )}

            <Field>
              <FieldLabel>Description on the order</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={description}
                    placeholder="What appears on the printed order"
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <div className="flex flex-wrap items-start gap-3">
              <Field className="w-24">
                <FieldLabel required>Quantity</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="text-right tabular-nums"
                      value={quantity}
                      onChange={(event) => {
                        setQuantity(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field className="w-32">
                <FieldLabel required>Cost each</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="text-right tabular-nums"
                      value={cost}
                      onChange={(event) => {
                        setCost(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field className="w-40">
                <FieldLabel>Their code</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={supplierSku}
                      placeholder="Optional"
                      spellCheck={false}
                      onChange={(event) => {
                        setSupplierSku(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            {lineTotal !== null ? (
              <div className="flex items-baseline gap-2">
                <Text as="span" className="text-sm">
                  Line total
                </Text>
                <Text as="span" className="text-lg font-semibold tabular-nums">
                  {formatCents(lineTotal, currency)}
                </Text>
              </div>
            ) : null}
          </div>

          <DialogFooter>
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
            <Button color="module" size="sm" disabled={!valid} onClick={submit}>
              {isEdit ? 'Save line' : 'Add line'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/* ── The pane ───────────────────────────────────────────────────────────── */

export function PurchaseOrderDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const toast = useToast();
  const confirm = useImperativeAlertDialog();
  const po = usePurchaseOrder(id);
  const locationsQuery = useStockLocations();
  const suppliers = useSuppliers({ includeArchived: false, take: 250, skip: 0 });

  const save = useSavePurchaseOrder();
  const place = usePlacePurchaseOrder(id);
  const cancel = useCancelPurchaseOrder(id);
  const close = useClosePurchaseOrder(id);
  const remove = useDeletePurchaseOrder(id);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [original, setOriginal] = useState<PurchaseOrderLine[]>([]);
  const [baseline, setBaseline] = useState<string>(JSON.stringify(emptyDraft()));
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<EditingLine | null>(null);

  const detail = po.data ?? null;
  const status = detail?.status ?? 'draft';
  const editable = isNew || (detail !== null && isEditable(status));

  // Seed local state once the record lands (or immediately for a new order).
  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (detail && !loaded) {
      const next = draftFromDetail(detail);
      setDraft(next);
      setOriginal(detail.lines);
      setBaseline(JSON.stringify(next));
      setLoaded(true);
    }
  }, [isNew, detail, loaded]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New purchase order' : (detail?.number ?? 'Purchase order'));
  }, [ctx, isNew, detail?.number]);

  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);

  const activeLocations = (locationsQuery.data?.items ?? []).filter(
    (location) => location.isActive
  );
  const supplierList = suppliers.data?.items ?? [];
  const supplierName =
    detail?.supplierName ??
    supplierList.find((supplier) => supplier.id === draft.header.supplierId)?.name ??
    null;
  // Built once per fetch so the Combobox's selected value is the SAME object
  // reference it holds in `items` — Base UI matches the highlighted option by
  // identity, and a fresh array each render would also re-key its effect.
  const supplierItems = useMemo(
    () =>
      (suppliers.data?.items ?? []).map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      })),
    [suppliers.data]
  );

  const subtotal = subtotalOf(draft.lines);
  const total = subtotal + draft.header.shippingCents;
  const currency = draft.header.currency || 'USD';

  const supplierChosen = draft.header.supplierId !== '';
  const warehouseChosen = draft.header.warehouseId !== '';
  const canSave =
    editable && supplierChosen && warehouseChosen && draft.lines.length > 0 && (isNew || dirty);

  useDirtySource(
    editable && dirty && loaded,
    isNew
      ? 'This purchase order has not been saved yet. Close anyway?'
      : `Changes to ${detail?.number ?? 'this order'} have not been saved. Close anyway?`
  );

  const setHeader = <K extends keyof PurchaseOrderHeaderDraft>(
    key: K,
    value: PurchaseOrderHeaderDraft[K]
  ) => {
    setDraft((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  };

  const upsertLine = (line: PurchaseOrderLineDraft) => {
    setDraft((current) => {
      const lines = [...current.lines];
      // Match by server id when editing, otherwise by variant — adding a variant
      // already on the order replaces its line rather than doubling it, mirroring
      // the server's own (order, variant) upsert. The existing server id is kept
      // so the replacement saves as an UPDATE, never a duplicate add.
      const index = line.id
        ? lines.findIndex((existing) => existing.id === line.id)
        : lines.findIndex((existing) => existing.variantId === line.variantId);
      if (index >= 0) {
        const existing = lines[index];
        lines[index] = { ...line, id: line.id ?? existing?.id };
      } else {
        lines.push(line);
      }
      return { ...current, lines };
    });
  };

  const removeLine = (line: PurchaseOrderLineDraft) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((existing) =>
        line.id ? existing.id !== line.id : existing !== line
      ),
    }));
  };

  const doSave = () =>
    new Promise<PurchaseOrderDetail | null>((resolve) => {
      save.mutate(
        { id, header: draft.header, lines: draft.lines, original },
        {
          onSuccess: (saved) => {
            if (isNew) {
              ctx.open('inventory.purchase-orders.detail', { id: saved.id }, { target: 'replace' });
              afterPaneChange(() => {
                toast.add({ title: `${saved.number} saved as a draft`, type: 'success' });
              });
            } else {
              const next = draftFromDetail(saved);
              setDraft(next);
              setOriginal(saved.lines);
              setBaseline(JSON.stringify(next));
              afterPaneChange(() => {
                toast.add({ title: `${saved.number} saved`, type: 'success' });
              });
            }
            resolve(saved);
          },
          onError: (error) => {
            toast.add({
              title: 'Could not save that order',
              description: buyingErrorMessage(error, 'Nothing was changed.'),
              type: 'error',
            });
            resolve(null);
          },
        }
      );
    });

  const onPlace = async () => {
    if (isNew || !detail) return;
    // Save any pending edits first so what is placed is what is on screen.
    if (dirty) {
      const saved = await doSave();
      if (!saved) return;
    }
    const ok = await confirm({
      title: `Place ${detail.number} with ${supplierName ?? 'the supplier'}?`,
      description:
        'This sends the order and locks it — you will not be able to change the items or quantities afterwards. As the goods arrive you book them in under Receiving.',
      confirmLabel: 'Place the order',
      cancelLabel: 'Keep it a draft',
      color: 'module',
    });
    if (!ok) return;
    place.mutate(undefined, {
      onSuccess: () => {
        afterPaneChange(() => {
          toast.add({ title: `${detail.number} placed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not place that order',
          description: buyingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onCancel = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: `Cancel ${detail.number}?`,
      description:
        'This calls the order off for good. Nothing has been received against it, so nothing is undone — but it cannot be reopened. Start a new order if you still need the goods.',
      confirmLabel: 'Cancel the order',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(undefined, {
      onSuccess: () => {
        afterPaneChange(() => {
          toast.add({ title: `${detail.number} cancelled`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not cancel that order',
          description: buyingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onClose = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: `Close ${detail.number}?`,
      description:
        'Closing stops you receiving any more against this order — use it when the rest will not arrive (a supplier short-shipped and settled). What has already been received stays booked in.',
      confirmLabel: 'Close the order',
      cancelLabel: 'Leave it open',
      color: 'warning',
    });
    if (!ok) return;
    close.mutate(undefined, {
      onSuccess: () => {
        afterPaneChange(() => {
          toast.add({ title: `${detail.number} closed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not close that order',
          description: buyingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: `Delete draft ${detail.number}?`,
      description:
        'This draft has never been placed, so deleting it removes it entirely. There is nothing to keep a record of.',
      confirmLabel: 'Delete the draft',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${detail.number} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete that draft',
          description: buyingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onReceive = () => {
    if (!detail) return;
    ctx.open(
      'inventory.receiving.detail',
      { id: 'new', purchaseOrderId: detail.id },
      { target: 'tab' }
    );
  };

  // A failed load REPLACES the pane.
  if (!isNew && po.isError) {
    const gone = isNotFound(po.error);
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color={gone ? 'warning' : 'danger'} variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>
                {gone ? 'This order no longer exists' : 'Could not load this order'}
              </AlertTitle>
              <AlertDescription>
                {gone
                  ? 'It may have been a draft that was deleted.'
                  : 'This is a problem reaching the server. The order itself is unaffected.'}
              </AlertDescription>
            </AlertContent>
            {gone ? null : (
              <Button
                size="sm"
                color="danger"
                variant="soft"
                onClick={() => {
                  void po.refetch();
                }}
              >
                Try again
              </Button>
            )}
          </Alert>
        </div>
      </div>
    );
  }

  if (!isNew && (po.isPending || !loaded)) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  const state = detail ? purchaseOrderState(detail) : null;
  const outstanding = detail ? outstandingUnits(detail) : 0;
  const canReceive = detail !== null && isReceivable(status);
  const saving = save.isPending;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Purchase order actions" wrap>
        {state ? (
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList className="size-4" aria-hidden />
            <Text as="span" className="text-sm font-medium">
              New order
            </Text>
          </span>
        )}

        {editable ? (
          <Button
            size="sm"
            color="module"
            className="ml-auto shrink-0"
            disabled={!canSave}
            loading={saving}
            onClick={() => {
              void doSave();
            }}
          >
            <Save className="size-4" aria-hidden />
            {isNew ? 'Save draft' : 'Save'}
          </Button>
        ) : (
          <span className="ml-auto" />
        )}

        {!isNew && editable ? (
          <Button
            size="sm"
            color="module"
            variant="outline"
            className="shrink-0"
            loading={place.isPending}
            onClick={() => {
              void onPlace();
            }}
          >
            <Send className="size-4" aria-hidden />
            Place order
          </Button>
        ) : null}

        {canReceive ? (
          <Button size="sm" color="module" className="shrink-0" onClick={onReceive}>
            <PackageCheck className="size-4" aria-hidden />
            Receive
          </Button>
        ) : null}

        {detail && (status === 'submitted' || status === 'partial' || status === 'received') ? (
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            className="shrink-0"
            loading={close.isPending}
            onClick={() => {
              void onClose();
            }}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Close
          </Button>
        ) : null}

        {detail && (status === 'draft' || status === 'submitted') ? (
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            className="shrink-0"
            loading={cancel.isPending}
            onClick={() => {
              void onCancel();
            }}
          >
            <Ban className="size-4" aria-hidden />
            Cancel
          </Button>
        ) : null}

        {detail && status === 'draft' ? (
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            shape="square"
            aria-label="Delete this draft"
            title="Delete this draft"
            loading={remove.isPending}
            onClick={() => {
              void onDelete();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}

        {isNew ? null : (
          <RefreshButton
            isFetching={po.isFetching}
            updatedAt={detail ? po.dataUpdatedAt : undefined}
            onRefresh={() => {
              void po.refetch();
            }}
          />
        )}
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {/* Identity for an existing order; a plain heading for a new one. */}
          {detail ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="font-mono text-2xl font-semibold">
                {detail.number}
              </Heading>
              <Text className="text-sm">
                {supplierName ?? 'No supplier'}
                {detail.warehouseName ? ` · Landing at ${detail.warehouseName}` : ''}
                {detail.orderedAt ? ` · Placed ${formatDay(detail.orderedAt)}` : ''}
              </Text>
              {state ? <Text className="text-sm">{state.detail}</Text> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                New purchase order
              </Heading>
              <Text>
                Choose who you are buying from and where it lands, add the items, then save it as a
                draft. You place it with the supplier when it is ready.
              </Text>
            </div>
          )}

          {/* Where a placed order stands, in one line. */}
          {detail && !editable ? (
            <Alert color={state?.tone ?? 'info'} variant="soft">
              <AlertContent>
                <AlertTitle>
                  {outstanding > 0
                    ? `${String(outstanding)} of ${String(detail.quantityOrdered)} units still to come`
                    : 'Everything ordered has been received'}
                </AlertTitle>
                <AlertDescription>{state?.detail}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="Order details">
            <div className="grid gap-3 @md:grid-cols-2">
              {/* Supplier: picked when creating, fixed once the order exists
                  (line prices are snapshots taken against them). */}
              {isNew ? (
                <Field>
                  <FieldLabel required>Supplier</FieldLabel>
                  <Combobox
                    color="module"
                    items={supplierItems}
                    value={
                      supplierItems.find((item) => item.value === draft.header.supplierId) ?? null
                    }
                    placeholder="Who are you buying from?"
                    emptyMessage="No supplier matches that."
                    aria-label="Supplier"
                    clearable={false}
                    onValueChange={(next) => {
                      const option = next as { value: string } | null;
                      if (option) setHeader('supplierId', option.value);
                    }}
                  />
                  <FieldDescription>Fixed once the order is saved.</FieldDescription>
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Supplier</FieldLabel>
                  <Input color="module" value={supplierName ?? ''} readOnly disabled />
                </Field>
              )}

              <Field>
                <FieldLabel required>Where it lands</FieldLabel>
                <NativeSelect
                  color="module"
                  value={draft.header.warehouseId}
                  disabled={!editable}
                  aria-label="Where it lands"
                  onChange={(event) => {
                    setHeader('warehouseId', event.target.value);
                  }}
                >
                  <option value="">Choose a location…</option>
                  {activeLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>The stock arrives into this location.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Your reference</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.header.reference ?? ''}
                      placeholder="A quote number, say"
                      disabled={!editable}
                      onChange={(event) => {
                        setHeader(
                          'reference',
                          event.target.value === '' ? null : event.target.value
                        );
                      }}
                    />
                  }
                />
              </Field>

              <Field>
                <FieldLabel>Expected</FieldLabel>
                <DateInput
                  color="module"
                  value={
                    draft.header.expectedArrivalAt ? new Date(draft.header.expectedArrivalAt) : null
                  }
                  disabled={!editable}
                  aria-label="Expected arrival date"
                  onValueChange={(date) => {
                    setHeader('expectedArrivalAt', date ? date.toISOString() : null);
                  }}
                />
                <FieldDescription>
                  When you expect it. Left blank, the supplier&apos;s usual lead time fills it in
                  when you place the order.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>How you pay</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={draft.header.paymentTerms ?? ''}
                      placeholder="net 30"
                      disabled={!editable}
                      onChange={(event) => {
                        setHeader(
                          'paymentTerms',
                          event.target.value === '' ? null : event.target.value
                        );
                      }}
                    />
                  }
                />
              </Field>

              <Field>
                <FieldLabel>Shipping cost</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={centsToInput(draft.header.shippingCents)}
                      disabled={!editable}
                      onChange={(event) => {
                        setHeader('shippingCents', inputToCents(event.target.value) ?? 0);
                      }}
                    />
                  }
                />
                <FieldDescription>Added to the order total, not to any one item.</FieldDescription>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Items"
            description={
              editable
                ? 'What you are ordering, and the price you have agreed for each.'
                : 'What was ordered, and how much of each has arrived.'
            }
            action={
              editable ? (
                <Button
                  size="sm"
                  variant="outline"
                  color="neutral"
                  disabled={!supplierChosen}
                  title={supplierChosen ? undefined : 'Choose a supplier first'}
                  onClick={() => {
                    setEditing({ line: null });
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Add a line
                </Button>
              ) : null
            }
          >
            {draft.lines.length === 0 && editable ? (
              <Text className="text-sm">
                {supplierChosen
                  ? 'No items yet. Add a line for each thing you are ordering.'
                  : 'Choose a supplier above, then add the items you are ordering from them.'}
              </Text>
            ) : null}

            {(editable ? draft.lines : (detail?.lines ?? [])).length > 0 ? (
              <Table size="sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right whitespace-nowrap">Qty</th>
                    <th className="hidden text-right whitespace-nowrap @md:table-cell">
                      Cost each
                    </th>
                    <th className="text-right whitespace-nowrap">Line total</th>
                    {editable ? (
                      <th className="w-0">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : (
                      <th className="whitespace-nowrap">Received</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {editable
                    ? draft.lines.map((line, index) => (
                        <tr key={line.id ?? `new-${String(index)}`}>
                          <td className="w-full max-w-0">
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">
                                {line.description ?? line.productTitle ?? 'Item'}
                              </span>
                              <span className="truncate font-mono text-sm">
                                {line.variantSku ?? 'No code'}
                                {line.supplierSku ? ` · ${line.supplierSku}` : ''}
                              </span>
                            </span>
                          </td>
                          <td className="text-right tabular-nums">{line.quantityOrdered}</td>
                          <td className="hidden text-right tabular-nums @md:table-cell">
                            {formatCents(line.unitCostCents, currency)}
                          </td>
                          <td className="text-right font-medium tabular-nums">
                            {formatCents(line.quantityOrdered * line.unitCostCents, currency)}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                color="neutral"
                                shape="square"
                                aria-label="Edit this line"
                                onClick={() => {
                                  setEditing({ line });
                                }}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                color="danger"
                                shape="square"
                                aria-label="Remove this line"
                                onClick={() => {
                                  removeLine(line);
                                }}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    : (detail?.lines ?? []).map((line) => {
                        const complete = line.quantityReceived >= line.quantityOrdered;
                        return (
                          <tr key={line.id}>
                            <td className="w-full max-w-0">
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate">
                                  {line.description ?? line.productTitle ?? 'Item'}
                                </span>
                                <span className="truncate font-mono text-sm">
                                  {line.variantSku ?? 'No code'}
                                </span>
                              </span>
                            </td>
                            <td className="text-right tabular-nums">{line.quantityOrdered}</td>
                            <td className="hidden text-right tabular-nums @md:table-cell">
                              {formatCents(line.unitCostCents, currency)}
                            </td>
                            <td className="text-right font-medium tabular-nums">
                              {formatCents(line.lineTotalCents, currency)}
                            </td>
                            <td className="whitespace-nowrap">
                              <Badge
                                color={complete ? 'success' : 'warning'}
                                variant="soft"
                                size="sm"
                              >
                                {line.quantityReceived} of {line.quantityOrdered}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </Table>
            ) : null}

            {/* Totals sit under the lines, right-aligned. */}
            {(editable ? draft.lines : (detail?.lines ?? [])).length > 0 ? (
              <div className="border-base-300 flex flex-col items-end gap-1 border-t pt-3">
                <div className="flex w-full max-w-xs items-baseline justify-between">
                  <Text className="text-sm">Items</Text>
                  <Text className="tabular-nums">{formatCents(subtotal, currency)}</Text>
                </div>
                {draft.header.shippingCents > 0 ? (
                  <div className="flex w-full max-w-xs items-baseline justify-between">
                    <Text className="text-sm">Shipping</Text>
                    <Text className="tabular-nums">
                      {formatCents(draft.header.shippingCents, currency)}
                    </Text>
                  </div>
                ) : null}
                <div className="flex w-full max-w-xs items-baseline justify-between">
                  <Text className="font-semibold">Total</Text>
                  <Text className="text-lg font-semibold tabular-nums">
                    {formatCents(total, currency)}
                  </Text>
                </div>
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Notes">
            <Field>
              <FieldLabel>Notes for this order</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={3}
                    value={draft.header.notes ?? ''}
                    placeholder="Delivery instructions, a PO reference on their side…"
                    disabled={!editable}
                    onChange={(event) => {
                      setHeader('notes', event.target.value === '' ? null : event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>
        </div>
      </div>

      {editable ? (
        <LineEditor
          supplierId={draft.header.supplierId}
          currency={currency}
          editing={editing}
          onClose={() => {
            setEditing(null);
          }}
          onSave={upsertLine}
        />
      ) : null}
    </div>
  );
}
