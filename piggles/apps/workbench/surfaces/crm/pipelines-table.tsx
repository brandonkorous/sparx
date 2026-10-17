'use client';

// The pipelines table: name, what each one moves, how many steps, and its state.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { Pipeline } from './pipelines-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function MovesBadge({ row }: { row: Pipeline }) {
  return (
    // WHAT this process moves (docs/144 §7.2): sales and help requests share one
    // list, and their stage words mean different things, so each wears a hue.
    <Badge color={row.objectKey === 'ticket' ? 'info' : 'module'} variant="soft" size="sm">
      {row.objectKey === 'ticket' ? 'Help requests' : 'Sales deals'}
    </Badge>
  );
}

function StateBadge({ row }: { row: Pipeline }) {
  // "Put away" is this console's word for hidden-but-kept; the filter says it too.
  if (row.archivedAt) {
    return (
      <Badge color="neutral" variant="soft" size="sm">
        Put away
      </Badge>
    );
  }
  return row.isDefault ? (
    <Badge color="module" variant="soft" size="sm">
      Default
    </Badge>
  ) : (
    <Badge color="success" variant="soft" size="sm">
      Active
    </Badge>
  );
}

function PipelineRow({ row, onOpen }: { row: Pipeline; onOpen: (event: OpenEvent) => void }) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td className="font-medium">{row.name}</td>
      <td>
        <MovesBadge row={row} />
      </td>
      <td data-label="Steps" className="hidden text-right text-sm tabular-nums @md:table-cell">
        {row.stages.length}
      </td>
      <td>
        <StateBadge row={row} />
      </td>
    </tr>
  );
}

export function PipelinesTable(props: {
  rows: Pipeline[];
  onOpen: (pipeline: Pipeline, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th>Moves</th>
          <th className="hidden text-right @md:table-cell">Steps</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <PipelineRow
            key={row.id}
            row={row}
            onOpen={(event) => {
              props.onOpen(row, event);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
