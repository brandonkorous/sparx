'use client';

// The ways-to-file table. Its three note columns are worded to match the editor one
// click away ("Reference", "Nesting", "Labels"), since a person reads both minutes
// apart and an owner has no use for "Key", "Structure" or "Terms" (issue 385).

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { REFERENCE_HELP, REFERENCE_LABEL } from './reference-word';
import { taxonomyKind, type Taxonomy } from './taxonomy-data';

type OpenTaxonomy = (taxonomy: Taxonomy, event: { shiftKey: boolean; altKey: boolean }) => void;

function TaxonomyRow({ taxonomy, onOpen }: { taxonomy: Taxonomy; onOpen: OpenTaxonomy }) {
  const kind = taxonomyKind(taxonomy.hierarchical);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(taxonomy, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(taxonomy, event);
      }}
    >
      <td>
        <span className="block max-w-72 truncate font-medium">{taxonomy.plural_name}</span>
      </td>
      <td className="hidden max-w-56 truncate font-mono text-sm @xl:table-cell">{taxonomy.key}</td>
      <td className="hidden @2xl:table-cell">
        {/* A badge only for the notable case; "Plain list" is the ordinary one and
            reads better as words than as a second pill (RULE #4). */}
        {kind ? (
          <Badge color="info" variant="soft" size="sm" title={kind.detail}>
            {kind.label}
          </Badge>
        ) : (
          <span className="text-sm">Plain list</span>
        )}
      </td>
      <td className="text-right tabular-nums">{taxonomy.term_count.toLocaleString()}</td>
    </tr>
  );
}

export function TaxonomyTable({ rows, onOpen }: { rows: Taxonomy[]; onOpen: OpenTaxonomy }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th className="hidden @xl:table-cell" title={REFERENCE_HELP}>
            {REFERENCE_LABEL}
          </th>
          <th className="hidden @2xl:table-cell">Nesting</th>
          <th className="text-right">Labels</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((taxonomy) => (
          <TaxonomyRow key={taxonomy.id} taxonomy={taxonomy} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
