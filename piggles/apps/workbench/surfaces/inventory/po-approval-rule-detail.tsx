'use client';

// ONE SPENDING LIMIT — set it up, or change it.
//
// Create and edit are the same surface (`{id:'new'}` renders what `{id}`
// renders), which is why this is a pane and not a modal.
//
// ── The defaults are the advice ───────────────────────────────────────────
//
// A new limit opens as "over £1,000, any supplier, any location, anybody who can
// administer". That is the shape almost every small business wants first, and
// somebody who has never set a purchasing control has no way to arrive at it
// from an empty form. Every choice is still theirs.
//
// ── The one thing that is genuinely dangerous ─────────────────────────────
//
// A limit of £0 holds EVERY order, including the £4 one for a box of screws.
// That is legitimate — some businesses want exactly that — but it is also what
// somebody types by accident, so the form says out loud what it will do before
// they save it.

import { useEffect, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faFloppyDisk, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, stockErrorMessage, useStockLocations } from './data';
import { useSuppliers } from './suppliers-data';
import {
  useCreatePoApprovalRule,
  useDeletePoApprovalRule,
  usePoApprovalRules,
  useUpdatePoApprovalRule,
} from './po-approvals-data';

/** The column the form is laid out in — the house width for a settings form. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

interface Draft {
  name: string;
  supplierId: string;
  warehouseId: string;
  /** Whole currency units in the box; converted to cents on save. */
  minAmount: string;
  requiredRole: string;
  isActive: boolean;
}

const NEW_DRAFT: Draft = {
  name: 'Orders over £1,000',
  supplierId: '',
  warehouseId: '',
  minAmount: '1000',
  requiredRole: 'admin',
  isActive: true,
};

export function PoApprovalRuleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = ctx.params.id ?? 'new';
  const isNew = id === 'new';

  // The list is already cached by the surface this pane opens from, so reading
  // one rule out of it costs nothing and there is no single-rule endpoint to
  // add for it.
  const rules = usePoApprovalRules(true);
  const existing = rules.data?.items.find((rule) => rule.id === id) ?? null;

  const suppliers = useSuppliers({ includeArchived: false, take: 250, skip: 0 });
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((location) => location.isActive);

  const create = useCreatePoApprovalRule();
  const update = useUpdatePoApprovalRule();
  const remove = useDeletePoApprovalRule();
  const confirm = useConfirm();
  const toast = useToast();

  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setDraft({
      name: existing.name,
      supplierId: existing.supplierId ?? '',
      warehouseId: existing.warehouseId ?? '',
      minAmount: (existing.minAmountCents / 100).toString(),
      requiredRole: existing.requiredRole ?? '',
      isActive: existing.isActive,
    });
    setDirty(false);
  }, [existing]);

  useDirtySource(dirty, 'This spending limit has unsaved changes. Close it anyway?');

  const patch = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setDirty(true);
  };

  const parsedAmount = Number.parseFloat(draft.minAmount);
  const minAmountCents = Number.isFinite(parsedAmount)
    ? Math.round(parsedAmount * 100)
    : Number.NaN;
  const amountValid = Number.isFinite(minAmountCents) && minAmountCents >= 0;
  const canSave = draft.name.trim().length > 0 && amountValid && dirty;

  const onSave = () => {
    const input = {
      name: draft.name.trim(),
      supplierId: draft.supplierId === '' ? null : draft.supplierId,
      warehouseId: draft.warehouseId === '' ? null : draft.warehouseId,
      minAmountCents,
      requiredRole: draft.requiredRole === '' ? null : draft.requiredRole,
      isActive: draft.isActive,
    };
    const done = (savedId: string) => {
      setDirty(false);
      afterCommit(() => {
        toast.add({
          title: isNew ? 'Spending limit set' : 'Spending limit saved',
          description:
            minAmountCents === 0
              ? 'Every purchase order will now wait for sign-off.'
              : `Orders over ${formatCents(minAmountCents)} will now wait for sign-off.`,
          type: 'success',
        });
      });
      if (isNew) ctx.open('inventory.purchase-orders.approval-rules.detail', { id: savedId });
    };
    const onError = (error: unknown) => {
      afterCommit(() => {
        toast.add({
          title: 'Could not save that limit',
          description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
          type: 'error',
        });
      });
    };

    if (isNew) {
      create.mutate(input, {
        onSuccess: (saved) => {
          done(saved.id);
        },
        onError,
      });
      return;
    }
    update.mutate(
      { id, input },
      {
        onSuccess: () => {
          done(id);
        },
        onError,
      }
    );
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Remove “${draft.name}”?`,
      description:
        'Orders it has already held keep their record of who approved them — that history is not deleted. What stops is the holding: from now on, orders that would have matched go straight to the supplier.',
      confirmLabel: 'Remove the limit',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        setDirty(false);
        afterCommit(() => {
          toast.add({ title: 'Spending limit removed', type: 'success' });
        });
        ctx.close();
      },
      onError: (error) => {
        afterCommit(() => {
          toast.add({
            title: 'Could not remove that limit',
            description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        });
      },
    });
  };

  if (!isNew && rules.isLoading) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the limit…" />
      </div>
    );
  }

  if (!isNew && !existing) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-base">
          That spending limit no longer exists. It may have been removed by someone else.
        </p>
      </div>
    );
  }

  return (
    <div className={`${PANE_SHELL} overflow-y-auto`}>
      <div className={COLUMN}>
        <Heading level={2} className="text-lg">
          {isNew ? 'Set a spending limit' : 'Spending limit'}
        </Heading>

        <FormSection
          title="What it is called"
          description="Buyers see this name when their order is held, so make it say why."
        >
          <Field>
            <FieldLabel>Name</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={draft.name}
                  placeholder="Orders over £1,000"
                  onChange={(event) => {
                    patch({ name: event.target.value });
                  }}
                />
              }
            />
          </Field>
        </FormSection>

        <FormSection
          title="When it applies"
          description="An order has to clear the amount AND match the supplier and location for this limit to hold it."
        >
          <Field>
            <FieldLabel>Hold orders over</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.minAmount}
                  onChange={(event) => {
                    patch({ minAmount: event.target.value });
                  }}
                />
              }
            />
            <FieldDescription>
              The order&apos;s total, including shipping. Leave it at 0 to hold every order.
            </FieldDescription>
          </Field>

          {minAmountCents === 0 ? (
            <Alert color="warning">
              <AlertContent>
                <AlertTitle>This will hold every single order</AlertTitle>
                <AlertDescription>
                  Including a £4 order for a box of screws. That is a real thing some businesses
                  want — but if you meant &ldquo;orders over £1,000&rdquo;, type 1000 above.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel>Only for this supplier</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={draft.supplierId}
                  onChange={(event) => {
                    patch({ supplierId: event.target.value });
                  }}
                >
                  <option value="">Any supplier</option>
                  {(suppliers.data?.items ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
            <FieldDescription>
              A supplier-specific limit is how you put extra eyes on somebody you do not yet trust —
              without slowing down everyone else.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Only for this location</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={draft.warehouseId}
                  onChange={(event) => {
                    patch({ warehouseId: event.target.value });
                  }}
                >
                  <option value="">Any location</option>
                  {activeLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
          </Field>
        </FormSection>

        <FormSection
          title="Who signs it off"
          description="Whoever it is has to be able to sign in and open the Sign-offs screen."
        >
          <Field>
            <FieldLabel>Approver</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={draft.requiredRole}
                  onChange={(event) => {
                    patch({ requiredRole: event.target.value });
                  }}
                >
                  <option value="">Anyone who can edit buying</option>
                  <option value="editor">Anyone who can edit</option>
                  <option value="admin">Any administrator</option>
                  <option value="owner">The owner</option>
                </NativeSelect>
              }
            />
            <FieldDescription>
              Naming one specific person is coming with the team screens. Until then a limit routes
              to a role, and whoever holds it can sign.
            </FieldDescription>
          </Field>
        </FormSection>

        <FormSection
          title="In force"
          description="Switch a limit off to stop it holding orders without losing the record of what it held before."
        >
          <Field>
            <FieldLabel>This limit is in force</FieldLabel>
            <FieldControl
              render={
                <Switch
                  color="module"
                  checked={draft.isActive}
                  onCheckedChange={(checked) => {
                    patch({ isActive: checked });
                  }}
                />
              }
            />
          </Field>
        </FormSection>

        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            color="module"
            disabled={!canSave}
            loading={create.isPending || update.isPending}
            onClick={onSave}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {isNew ? 'Set the limit' : 'Save changes'}
          </Button>
          {dirty ? <Text className="text-sm">You have unsaved changes.</Text> : null}
          {!isNew ? (
            <Button
              className="ml-auto"
              variant="outline"
              color="danger"
              loading={remove.isPending}
              onClick={() => {
                void onDelete();
              }}
            >
              <Icon glyph={faTrashCan} className="size-4" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
