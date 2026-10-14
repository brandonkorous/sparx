'use client';

// The connected mailboxes, one row each. Moved out of mailboxes-list.tsx (sparx
// persona issue 236) unchanged.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faArrowsRotate, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { Table } from '../../components/table';
import { describeLastSync, statusLabel, statusTone, type Mailbox } from './mailboxes-data';

export interface MailboxRowMoves {
  syncing: boolean;
  onSync: (id: string) => void;
  onRemove: (id: string, address: string) => void;
}

function UsedByCell({ row }: { row: Mailbox }) {
  return (
    <td>
      {/* Personal vs shared is a privacy boundary, not a
          preference, so it wears a real color. */}
      <Badge color={row.scope === 'shared' ? 'warning' : 'module'} variant="soft" size="sm">
        {row.scope === 'shared' ? 'Whole team' : 'One person'}
      </Badge>
      <span className="mt-1 block text-xs">
        {row.syncGate === 'known_contacts_only' ? 'Keeps only known contacts' : 'Keeps everything'}
      </span>
    </td>
  );
}

function ActionsCell({ row, moves }: { row: Mailbox; moves: MailboxRowMoves }) {
  return (
    <td>
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          color="module"
          variant="ghost"
          title="Check for new mail now"
          disabled={moves.syncing}
          onClick={() => {
            moves.onSync(row.id);
          }}
        >
          <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
          <span className="sr-only">Check for new mail</span>
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="ghost"
          title="Disconnect this mailbox"
          onClick={() => {
            moves.onRemove(row.id, row.emailAddress);
          }}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          <span className="sr-only">Disconnect</span>
        </Button>
      </div>
    </td>
  );
}

function MailboxRow({ row, moves }: { row: Mailbox; moves: MailboxRowMoves }) {
  return (
    <tr>
      <td className="font-medium">
        {row.emailAddress}
        {row.displayName ? (
          <span className="block text-sm font-normal">{row.displayName}</span>
        ) : null}
      </td>
      <UsedByCell row={row} />
      <td>
        <Badge color={statusTone(row.status)} variant="soft" size="sm">
          {statusLabel(row.status)}
        </Badge>
        {row.lastError ? <span className="mt-1 block text-xs">{row.lastError}</span> : null}
      </td>
      <td className="hidden text-sm @lg:table-cell">{describeLastSync(row.lastSyncedAt)}</td>
      <ActionsCell row={row} moves={moves} />
    </tr>
  );
}

export function MailboxesTable({ rows, moves }: { rows: Mailbox[]; moves: MailboxRowMoves }) {
  return (
    <Table size="sm">
      <thead>
        <tr>
          <th>Mailbox</th>
          <th>Used by</th>
          <th>State</th>
          <th className="hidden @lg:table-cell">Last checked</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <MailboxRow key={row.id} row={row} moves={moves} />
        ))}
      </tbody>
    </Table>
  );
}
