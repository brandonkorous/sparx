'use client';

// State and saving for a return being put together. Nothing leaves the shelf
// here: a draft is a list assembled while the pallet is still in the building.

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { afterCommit } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, physicalLocations, stockErrorMessage, useStockLocations } from './data';
import { useSuppliers, useVariantLookup } from './suppliers-data';
import { useCreateSupplierReturn } from './supplier-returns-data';

// Every line carries what you PAID, because that is what you are owed. A line
// with no cost writes the money off quietly, so the server refuses one it cannot cost.
export interface DraftLine {
  variantId: string;
  sku: string;
  productTitle: string | null;
  quantity: number;
  /** Whole currency units as typed; blank means "work it out from what we
   *  paid", which the server does, and refuses if it cannot. */
  unitCost: string;
}

type Toast = ReturnType<typeof useToast>;

function useNewReturnFields(activeLocations: ReturnType<typeof physicalLocations>) {
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState<string>('damaged');
  const [rmaNumber, setRmaNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [skuInput, setSkuInput] = useState('');
  // The location the console filled in, when there was only one to fill in.
  // Choosing a different one is her work; accepting the only answer is not,
  // and a form she never touched must close without a question.
  const defaultWarehouseRef = useRef('');

  // ONLY when there is one. Pre-choosing whichever sorted first sent returns out
  // of the wrong place, taking stock off the wrong shelf. With more than one,
  // she picks. (`bin-detail` next door has had this right all along.)
  useEffect(() => {
    if (warehouseId === '' && activeLocations.length === 1) {
      const only = activeLocations[0]?.id ?? '';
      setWarehouseId(only);
      defaultWarehouseRef.current = only;
    }
  }, [activeLocations, warehouseId]);

  return {
    supplierId,
    setSupplierId,
    warehouseId,
    setWarehouseId,
    reason,
    setReason,
    rmaNumber,
    setRmaNumber,
    notes,
    setNotes,
    lines,
    setLines,
    skuInput,
    setSkuInput,
    defaultWarehouseRef,
  };
}

type NewReturnFields = ReturnType<typeof useNewReturnFields>;

function addLineBySku(
  fields: NewReturnFields,
  lookup: ReturnType<typeof useVariantLookup>,
  toast: Toast
) {
  const sku = fields.skuInput.trim();
  if (sku === '') return;
  lookup.mutate(sku, {
    onSuccess: (found) => {
      fields.setSkuInput('');
      fields.setLines((current) => [
        ...current,
        {
          variantId: found.variantId,
          sku: found.sku,
          productTitle: found.productTitle,
          quantity: 1,
          unitCost: '',
        },
      ]);
    },
    onError: () => {
      afterCommit(() => {
        toast.add({
          title: 'No item with that code',
          description: `Nothing in your catalog is coded “${sku}”. Check the code and try again.`,
          type: 'error',
        });
      });
    },
  });
}

function saveNewReturn(
  ctx: SurfaceContext,
  create: ReturnType<typeof useCreateSupplierReturn>,
  toast: Toast,
  fields: NewReturnFields
) {
  const { supplierId, warehouseId, reason, rmaNumber, notes, lines } = fields;
  create.mutate(
    {
      supplierId,
      warehouseId,
      reason,
      ...(rmaNumber.trim() ? { rmaNumber: rmaNumber.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lines: lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        ...(line.unitCost.trim() !== '' && Number.isFinite(Number(line.unitCost))
          ? { unitCostCents: Math.round(Number(line.unitCost) * 100) }
          : {}),
      })),
    },
    {
      onSuccess: (saved) => {
        afterCommit(() => {
          toast.add({
            title: `${saved.number} put together`,
            description: `${formatCents(saved.creditExpectedCents, saved.currency)} to claim back. Nothing has left the shelf yet.`,
            type: 'success',
          });
        });
        ctx.open('inventory.supplier-returns.detail', { id: saved.id }, { target: 'replace' });
      },
      onError: (error) => {
        afterCommit(() => {
          toast.add({
            title: 'Could not save that return',
            description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        });
      },
    }
  );
}

export function useNewSupplierReturn(ctx: SurfaceContext) {
  const suppliers = useSuppliers({ includeArchived: false, take: 250, skip: 0 });
  const locations = useStockLocations();
  // Somewhere a pallet can physically leave from. "In transit" is a bucket,
  // not a loading bay, and it sat in this list between the two real ones.
  const activeLocations = physicalLocations(locations.data?.items ?? []);

  const create = useCreateSupplierReturn();
  const lookup = useVariantLookup();
  const toast = useToast();
  const fields = useNewReturnFields(activeLocations);

  // What is on screen, against what was put there (issue 507). `!create.isSuccess`
  // because this pane replaces itself with the saved return the moment it succeeds.
  const dirty =
    !create.isSuccess &&
    (fields.supplierId !== '' ||
      fields.warehouseId !== fields.defaultWarehouseRef.current ||
      fields.reason !== 'damaged' ||
      fields.rmaNumber.trim() !== '' ||
      fields.notes.trim() !== '' ||
      fields.skuInput.trim() !== '' ||
      fields.lines.length > 0);
  useDirtySource(dirty, 'This return has not been saved. Close it anyway?');

  const addLine = () => {
    addLineBySku(fields, lookup, toast);
  };

  const canSave =
    fields.supplierId !== '' &&
    fields.warehouseId !== '' &&
    fields.lines.length > 0 &&
    fields.lines.every((l) => l.quantity > 0);

  const onSave = () => {
    saveNewReturn(ctx, create, toast, fields);
  };

  return { ...fields, suppliers, activeLocations, create, lookup, addLine, canSave, onSave };
}

export type NewReturnState = ReturnType<typeof useNewSupplierReturn>;
