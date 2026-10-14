'use client';

// The connected phone systems, one row each, and disconnecting one. Moved out of
// phone-systems-list.tsx (sparx persona issue 239) unchanged.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { Table } from '../../components/table';
import { useSites } from '../../lib/api/shell-data';
import { useConfirm } from '../../lib/confirm';
import { productCopy } from '../../lib/product';
import {
  useDisconnectPhoneSystem,
  voiceStatusLabel,
  voiceStatusTone,
  type VoiceConnection,
} from './calls-data';

function useDisconnect() {
  const toast = useToast();
  const confirm = useConfirm();
  const disconnect = useDisconnectPhoneSystem();
  return async (id: string, fromNumber: string) => {
    const ok = await confirm({
      title: `Disconnect ${fromNumber}?`,
      description: productCopy(
        'crm.phone.disconnect',
        'Piggles stops placing calls through this account. The calls already logged on your customers’ records are kept: disconnecting has never meant deleting your call history.'
      ),
      confirmLabel: 'Disconnect it',
      cancelLabel: 'Keep it connected',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(id, {
      onSuccess: () => {
        toast.add({ title: 'Phone system disconnected', type: 'success' });
      },
      onError: () => {
        toast.add({ title: 'Could not disconnect that phone system', type: 'error' });
      },
    });
  };
}

function useSiteName() {
  const { data: sites } = useSites();
  const siteList = sites ?? [];
  return (propertyId: string | null): string => {
    if (!propertyId) return 'Every site';
    return siteList.find((site) => site.id === propertyId)?.name ?? 'One site';
  };
}

function PhoneSystemRow(props: {
  row: VoiceConnection;
  siteName: string;
  onRemove: (id: string, fromNumber: string) => void;
}) {
  const { row } = props;
  return (
    <tr>
      <td className="font-medium">
        {row.fromNumber}
        <span className="block text-sm font-normal">{row.accountSid}</span>
      </td>
      <td>
        {/* Which business this number speaks for — the thing that
            decides who gets called from it. */}
        <Badge color={row.propertyId ? 'module' : 'info'} variant="soft" size="sm">
          {props.siteName}
        </Badge>
      </td>
      <td>
        <Badge color={voiceStatusTone(row.status)} variant="soft" size="sm">
          {voiceStatusLabel(row.status)}
        </Badge>
        {row.lastError ? <span className="mt-1 block text-xs">{row.lastError}</span> : null}
      </td>
      <td className="hidden @lg:table-cell">
        {/* A legal posture, not a setting — so it reads as one. */}
        <Badge color={row.recordingEnabled ? 'warning' : 'neutral'} variant="soft" size="sm">
          {row.recordingEnabled ? 'Recording on' : 'Not recording'}
        </Badge>
      </td>
      <td>
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            color="danger"
            variant="ghost"
            title="Disconnect this phone system"
            onClick={() => {
              props.onRemove(row.id, row.fromNumber);
            }}
          >
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
            <span className="sr-only">Disconnect</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function PhoneSystemsTable({ rows }: { rows: VoiceConnection[] }) {
  const remove = useDisconnect();
  const siteName = useSiteName();
  return (
    <Table size="sm">
      <thead>
        <tr>
          <th>Number</th>
          <th>Used by</th>
          <th>State</th>
          <th className="hidden @lg:table-cell">Recording</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <PhoneSystemRow
            key={row.id}
            row={row}
            siteName={siteName(row.propertyId)}
            onRemove={(id, fromNumber) => {
              void remove(id, fromNumber);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
