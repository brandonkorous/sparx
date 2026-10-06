'use client';

import { Badge, Button } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../../components/pane-toolbar';
import { RefreshButton } from '../../../components/refresh-button';
import { accountState, type AccountDetail } from '../accounts-data';

interface AccountToolbarProps {
  account?: AccountDetail;
  saving: boolean;
  nameError: string | null;
  isNew: boolean;
  dirty: boolean;
  submit: () => void;
  isFetching?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
}

export function AccountToolbar({
  account,
  saving,
  nameError,
  isNew,
  dirty,
  submit,
  isFetching,
  updatedAt,
  onRefresh,
}: AccountToolbarProps) {
  const state = account ? accountState(account.status) : null;
  return (
    <PaneToolbar
      label="Account actions"
      status={
        state ? (
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        ) : null
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={saving}
          disabled={Boolean(nameError) || (!isNew && !dirty)}
          onClick={submit}
        >
          {isNew ? 'Add customer' : 'Save'}
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
  );
}
