'use client';

// The table of things you track: one row per record type, opening the type,
// with an Open button on the business's own types that opens their records.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import type { CrmObjectType } from './object-types-data';
import { productCopy } from '../../lib/product';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function KindBadge({ row }: { row: CrmObjectType }) {
  return (
    // Built-in vs yours is a real distinction (one can be extended, the other
    // can also be put away), so it wears a real color rather than a grey chip.
    <Badge color={row.kind === 'builtin' ? 'info' : 'module'} variant="soft" size="sm">
      {row.kind === 'builtin'
        ? productCopy('crm.objectTypes.builtInBadge', 'Comes with sparx')
        : 'Yours'}
    </Badge>
  );
}

function OpenRecordsButton({ row, ctx }: { row: CrmObjectType; ctx: SurfaceContext }) {
  return (
    <Button
      color="module"
      variant="soft"
      size="sm"
      aria-label={`Open the ${row.labelPlural.toLowerCase()}`}
      title="Open these records"
      onClick={(event) => {
        // Stop the row's own click: this opens the ROWS, the row opens the TYPE.
        event.stopPropagation();
        ctx.open('crm.records.list', { objectKey: row.key }, { target: targetFor(event) });
      }}
    >
      Open
    </Button>
  );
}

function ObjectTypeRow({ row, ctx }: { row: CrmObjectType; ctx: SurfaceContext }) {
  const count = row.propertySchema?.fields?.length ?? 0;
  const open = (event: OpenEvent) => {
    ctx.open('crm.object-type.detail', { key: row.key }, { target: targetFor(event) });
  };
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open(event);
      }}
    >
      <td className="font-medium">
        {row.labelPlural}
        {row.archivedAt ? (
          <Badge color="neutral" variant="soft" size="sm" className="ml-2">
            Put away
          </Badge>
        ) : null}
      </td>
      <td>
        <KindBadge row={row} />
      </td>
      <td data-label="Extra details" className="text-right font-mono text-sm tabular-nums">
        {count === 0 ? '—' : count}
      </td>
      <td className="hidden text-sm @lg:table-cell">{row.description ?? '—'}</td>
      <td className="text-right">
        {row.kind === 'custom' && !row.archivedAt ? (
          <OpenRecordsButton row={row} ctx={ctx} />
        ) : null}
      </td>
    </tr>
  );
}

export function ObjectTypesTable({ rows, ctx }: { rows: CrmObjectType[]; ctx: SurfaceContext }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Thing you track</th>
          <th>Kind</th>
          <th className="text-right">Extra details</th>
          <th className="hidden @lg:table-cell">What it is</th>
          <th className="text-right">
            <span className="sr-only">Open its records</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ObjectTypeRow key={row.id} row={row} ctx={ctx} />
        ))}
      </tbody>
    </Table>
  );
}
