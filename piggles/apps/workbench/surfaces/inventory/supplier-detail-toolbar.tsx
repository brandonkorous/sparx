'use client';

// The supplier pane's toolbar: where the supplier stands, Save (or Add supplier
// before it exists), and a refresh once there is a record to refresh.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faFloppyDisk, faTruck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { supplierState } from './suppliers-data';
import type { SupplierDetailState } from './use-supplier-detail';

function SupplierStatus({ detail }: { detail: SupplierDetailState }) {
  const state = detail.supplier.data ? supplierState(detail.supplier.data) : null;
  return state ? (
    <Badge color={state.tone} variant="soft" size="sm">
      {state.label}
    </Badge>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <Icon glyph={faTruck} className="size-4" aria-hidden />
      <Text as="span" className="text-sm font-medium">
        New supplier
      </Text>
    </span>
  );
}

export function SupplierToolbar({ detail }: { detail: SupplierDetailState }) {
  const { supplier, isNew } = detail;
  return (
    <PaneToolbar
      label="Supplier actions"
      status={<SupplierStatus detail={detail} />}
      primary={
        <Button
          size="sm"
          color="module"
          className="ml-auto shrink-0"
          disabled={!detail.canSave}
          loading={detail.saving}
          onClick={detail.save}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          {isNew ? 'Add supplier' : 'Save'}
        </Button>
      }
      refresh={
        isNew ? null : (
          <RefreshButton
            isFetching={supplier.isFetching}
            updatedAt={supplier.data ? supplier.dataUpdatedAt : undefined}
            onRefresh={() => {
              void supplier.refetch();
            }}
          />
        )
      }
    />
  );
}
