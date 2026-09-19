'use client';

// One group of content types as a table — "the ones you made" or "the built-in
// ones you can't change".
//
// Split out of content-types-list.tsx under the size rule, the same seam the
// authors and categories lists use. The pane owns loading, searching and
// filtering; this owns the rows and the two numbers in the Entries column.

import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
// The house table wrapper, not silica's — the same one every other list in the
// app uses, so these rows sit at the same density as the ones beside them.
import { IDENTITY_CELL, Table } from '../../components/table';
import type { ContentType, EntryCounts } from './content-types-data';
// Both readers take the whole MAP, not a looked-up row, because a missing key in
// a loaded map is a real zero and a missing map is an unknown — and `?.get()`
// flattens the two into one blank cell. See the module's own note.
import { entriesElsewhereLabel, entriesHereLabel } from './content-type-usage-words';
import { REFERENCE_HELP, REFERENCE_LABEL } from './reference-word';

export interface TypeGroupProps {
  title: string;
  description: string;
  types: ContentType[];
  counts: Map<string, EntryCounts> | undefined;
  /** Shown instead of the rows when the group is empty; null hides the group. */
  emptyHint: string | null;
  onOpen: (type: ContentType, event: { shiftKey: boolean; altKey: boolean }) => void;
}

export function TypeGroup({
  title,
  description,
  types,
  counts,
  emptyHint,
  onOpen,
}: TypeGroupProps) {
  if (types.length === 0 && emptyHint === null) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5 px-1">
        <Heading level={2} className="text-lg font-semibold">
          {title}
        </Heading>
        <Text className="text-sm">{description}</Text>
      </div>

      {types.length === 0 ? (
        <Text className="px-1 text-sm">{emptyHint}</Text>
      ) : (
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>Name</th>
              {/* "Reference", not "Key" — the SAME word the taxonomy pane and the
                  type editor use for the same idea. Issue 389 left this section
                  calling one thing three names: Key here, Id in the editor one
                  click away, Reference in the twin pane beside it. The tooltip is
                  the taxonomy pane's, verbatim, because it is the same fact. */}
              <th className="hidden @xl:table-cell" title={REFERENCE_HELP}>
                {REFERENCE_LABEL}
              </th>
              <th className="hidden @2xl:table-cell">Entries</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => {
              const usage = entriesHereLabel(counts, type.key);
              const elsewhere = entriesElsewhereLabel(counts, type.key);
              return (
                <tr
                  key={type.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  onClick={(event) => {
                    onOpen(type, event);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onOpen(type, event);
                  }}
                >
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{type.name}</span>
                      {type.is_singleton ? (
                        <Badge color="info" variant="soft" size="sm">
                          Only one
                        </Badge>
                      ) : null}
                      {type.is_built_in ? (
                        <Badge color="info" variant="soft" size="sm">
                          View only
                        </Badge>
                      ) : null}
                    </span>
                    {/* The shared cap, not a number of its own. `max-w-96` was 384px
                        inside a 327px pane, so the table scrolled sideways by 89px on a
                        phone and the sentence was clipped mid-word with no ellipsis —
                        the very failure IDENTITY_CELL's own note describes one size
                        down (issue 390). */}
                    {type.description ? (
                      <span className={`mt-0.5 block truncate text-sm ${IDENTITY_CELL}`}>
                        {type.description}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden font-mono text-sm @xl:table-cell">{type.key}</td>
                  <td className="hidden text-sm @2xl:table-cell">
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap">{usage}</span>
                      {elsewhere ? <span className="whitespace-nowrap">{elsewhere}</span> : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </section>
  );
}
