'use client';

// The list for a tenant-invented object (docs/144 §3.6).
//
// ONE SURFACE FOR EVERY CUSTOM OBJECT. The pane's `objectKey` param says which
// one; everything on screen — the title, the columns, the empty state's wording,
// the button that adds a row — comes from the object definition. A business that
// invents "Service contract" gets a working list with no code written for them,
// which is the entire promise of the registry.
//
// THE COLUMNS ARE THE FIRST FOUR PROPERTIES, in the order the business declared
// them. That ordering is not arbitrary: the property editor is a list somebody
// dragged into the order that made sense to them, so the order they chose is the
// best available answer to "which of these matters most", and guessing by type
// would override a decision they already made.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Heading,
  Input,
  Table,
  Text,
} from '@wizeworks/silicaui-react';
import { Plus, Table2 } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useObjectType } from './object-types-data';
import { cellText, recordErrorMessage, recordTitle, useRecords } from './records-data';

const COLUMN = 'mx-auto flex w-full max-w-6xl flex-col gap-4';

/** Shift opens alongside, Alt pops out — the same modifier contract every other
 *  list in the workbench uses. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function RecordsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const objectKey = String(ctx.params.objectKey ?? '');
  const [q, setQ] = useState('');

  const type = useObjectType(objectKey);
  const records = useRecords(objectKey, { q });

  useEffect(() => {
    ctx.setTitle(type.data?.labelPlural ?? 'Records');
  }, [ctx, type.data?.labelPlural]);

  // The first four declared properties, plus whatever the business nominated as
  // the title — which leads, because it is what a person scans by.
  const columns = useMemo(() => {
    const fields = type.data?.propertySchema?.fields ?? [];
    const primaryKey = type.data?.primaryFieldKey ?? null;
    const rest = fields.filter((f) => f.key !== primaryKey).slice(0, 3);
    return { primaryKey, rest };
  }, [type.data]);

  const rows = records.data?.items ?? [];
  const label = type.data?.label ?? 'record';
  const labelPlural = type.data?.labelPlural ?? 'records';

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label={`${labelPlural} list controls`}>
        <Table2 className="size-4 shrink-0" aria-hidden />
        <Input
          color="module"
          size="sm"
          className="max-w-64"
          aria-label={`Search ${labelPlural.toLowerCase()}`}
          placeholder={`Search ${labelPlural.toLowerCase()}`}
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          title={`Add a ${label.toLowerCase()} — hold Shift to open alongside, Alt for a new window`}
          onClick={(event) => {
            ctx.open('crm.record.detail', { id: 'new', objectKey }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add {label.toLowerCase()}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {records.isError ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not load these {labelPlural.toLowerCase()}</AlertTitle>
                <AlertDescription>
                  {recordErrorMessage(records.error, 'Try again in a moment.')}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {rows.length === 0 && records.isSuccess ? (
            <Card className="p-6">
              <div className="flex flex-col gap-2">
                <Heading level={2} className="text-lg">
                  No {labelPlural.toLowerCase()} yet
                </Heading>
                <Text>
                  {q.trim()
                    ? 'Nothing matched that search.'
                    : `You invented this record type — add the first ${label.toLowerCase()} and it will show here.`}
                </Text>
              </div>
            </Card>
          ) : null}

          {rows.length > 0 ? (
            <Card className="p-0">
              <Table>
                <thead>
                  <tr>
                    <th>{label}</th>
                    {columns.rest.map((field) => (
                      <th key={field.key} className="hidden @md:table-cell">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr
                      key={record.id}
                      className="cursor-pointer"
                      onClick={(event) => {
                        ctx.open(
                          'crm.record.detail',
                          { id: record.id, objectKey },
                          { target: targetFor(event) }
                        );
                      }}
                    >
                      <td>
                        <Text as="span" className="font-medium">
                          {recordTitle(record, columns.primaryKey)}
                        </Text>
                      </td>
                      {columns.rest.map((field) => (
                        <td key={field.key} className="hidden @md:table-cell">
                          {cellText(record.values[field.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
