'use client';

// The rules themselves. Rows are not clickable: a redirect has no editable
// surface — it is created, imported or deleted, never changed in place — so the
// only per-row action is remove.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faArrowRight, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { formatDate, redirectTypeMeta, type Redirect } from './redirects-data';

interface RedirectsTableProps {
  rows: readonly Redirect[];
  onDelete: (row: Redirect) => void;
  /** Which row is mid-delete, so only its own button spins. */
  removingId: string | null;
  busy: boolean;
}

export function RedirectsTable({ rows, onDelete, removingId, busy }: RedirectsTableProps) {
  return (
    <Table size="sm">
      <thead>
        <tr>
          <th>Redirect</th>
          <th>Type</th>
          <th className="hidden text-right @xl:table-cell">Times used</th>
          <th className="hidden @2xl:table-cell">Added</th>
          <th className="text-right">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const type = redirectTypeMeta(row.status_code);
          return (
            <tr key={row.id}>
              <td>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="max-w-96 truncate font-mono text-sm font-medium">
                    {row.from_path}
                  </span>
                  <span className="flex max-w-96 items-center gap-1 font-mono text-sm">
                    <Icon glyph={faArrowRight} className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{row.to_path}</span>
                  </span>
                  {row.property_id === null ? (
                    <span className="text-sm">Shared across all your sites</span>
                  ) : null}
                </div>
              </td>
              <td>
                <Badge color={type.tone} variant="soft" size="sm" title={type.detail}>
                  {type.label}
                </Badge>
              </td>
              <td className="hidden text-right tabular-nums @xl:table-cell">
                {row.hit_count.toLocaleString()}
              </td>
              <td className="hidden text-sm whitespace-nowrap @2xl:table-cell">
                {formatDate(row.created_at)}
              </td>
              <td className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  color="danger"
                  shape="square"
                  aria-label={`Remove the redirect from ${row.from_path}`}
                  title="Remove this redirect"
                  loading={removingId === row.id && busy}
                  disabled={busy}
                  onClick={() => {
                    onDelete(row);
                  }}
                >
                  <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
