'use client';

// The rows of a tenant-invented record type: the title column, then the first
// three declared properties. Moved out of records-list.tsx (sparx persona issue
// 240) unchanged.

import { Text } from '@wizeworks/silicaui-react';

import { Table } from '../../components/table';
import type { PropertyField } from './object-types-data';
import { cellText, recordTitle, type CrmRecord } from './records-data';

export interface RecordColumns {
  primaryKey: string | null;
  rest: PropertyField[];
}

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function RecordRow(props: {
  record: CrmRecord;
  columns: RecordColumns;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const { record, columns, onOpen } = props;
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(record.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(record.id, event);
      }}
    >
      <td>
        <Text as="span" className="font-medium">
          {recordTitle(record, columns.primaryKey)}
        </Text>
      </td>
      {columns.rest.map((field) => (
        <td data-label={field.label} key={field.key} className="hidden @md:table-cell">
          {cellText(record.values[field.key], field)}
        </td>
      ))}
    </tr>
  );
}

export function RecordsTable(props: {
  rows: CrmRecord[];
  columns: RecordColumns;
  label: string;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const { rows, columns } = props;
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>{props.label}</th>
          {columns.rest.map((field) => (
            <th key={field.key} className="hidden @md:table-cell">
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((record) => (
          <RecordRow key={record.id} record={record} columns={columns} onOpen={props.onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
