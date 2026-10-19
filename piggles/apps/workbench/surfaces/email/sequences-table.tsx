'use client';

// The automatic emails table. Columns disclose with @container, never a
// viewport query: a narrow pane on a wide monitor must not show six columns.

import { Badge } from '@wizeworks/silicaui-react';
import { IDENTITY_CELL, Table } from '../../components/table';
import type { SequenceRow } from './sequences-data';
import { sequenceRowState } from './sequence-words';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function SequenceTableRow(props: {
  sequence: SequenceRow;
  siteName: (propertyId: string | null) => string;
  onOpen: (event: OpenEvent) => void;
}) {
  const { sequence, onOpen } = props;
  const state = sequenceRowState(sequence.status, sequence.enrollers);
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
      <td className={IDENTITY_CELL}>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{sequence.name}</span>
          {sequence.description ? (
            <span className="truncate text-sm">{sequence.description}</span>
          ) : null}
        </div>
      </td>
      <td className="hidden text-right tabular-nums @md:table-cell" data-label="Emails">
        {sequence.steps.length}
      </td>
      <td className="hidden text-right tabular-nums @lg:table-cell" data-label="In progress">
        {sequence.counts.active}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell" data-label="Enrolled">
        {sequence.counts.total}
      </td>
      <td className="hidden max-w-40 truncate text-sm @2xl:table-cell" data-label="For">
        {props.siteName(sequence.propertyId)}
      </td>
      <td>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function SequencesTable(props: {
  rows: SequenceRow[];
  siteName: (propertyId: string | null) => string;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th className="hidden text-right @md:table-cell">Emails</th>
          <th className="hidden text-right @lg:table-cell">In progress</th>
          <th className="hidden text-right @xl:table-cell">Enrolled</th>
          <th className="hidden @2xl:table-cell">For</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((sequence) => (
          <SequenceTableRow
            key={sequence.id}
            sequence={sequence}
            siteName={props.siteName}
            onOpen={(event) => {
              props.onOpen(sequence.id, event);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
