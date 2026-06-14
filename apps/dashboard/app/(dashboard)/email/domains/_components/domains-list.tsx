'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Badge,
  Button,
  Code,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

import { DnsRecordsTable } from './dns-records-table';
import { DomainActions } from './domain-actions';
import { DomainCard, STATE_BADGE, STATE_HINT } from './domain-card';
import type { SendingDomainRow } from '../../_lib/types';

// Client wrapper for the sending-domains list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. The card
// view reuses the bespoke DomainCard verbatim via `card.render` (it owns the
// DNS disclosure + per-domain actions). Read-only selection-wise —
// `selectable={false}` (each domain has its own Verify / Make default / Remove
// actions, not a bulk bar). The table view mirrors the card's key fields and
// keeps the DNS records reachable via a per-row disclosure under the domain.

interface DomainsListProps {
  rows: SendingDomainRow[];
  view: 'table' | 'card';
}

// First table column: the domain, its state hint, and an expandable DNS-records
// panel (so the records published at the registrar stay reachable in the table
// view, the same as the card's disclosure).
function DomainCell({ domain }: { domain: SendingDomainRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Stack gap={2} className="min-w-0">
      <Stack direction="row" align="center" gap={2}>
        <Code>{domain.domain}</Code>
        {domain.isDefault ? <Badge color="module">Default</Badge> : null}
      </Stack>
      <Text size="xs" variant="muted">
        {STATE_HINT[domain.state]}
      </Text>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="w-fit"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        DNS records
      </Button>
      {open ? <DnsRecordsTable records={domain.dnsRecords} /> : null}
    </Stack>
  );
}

export function DomainsList({ rows, view }: DomainsListProps) {
  const columns: SelectionColumn<SendingDomainRow>[] = [
    {
      header: 'Domain',
      cell: (d) => <DomainCell domain={d} />,
    },
    {
      header: 'Status',
      cell: (d) => {
        const badge = STATE_BADGE[d.state];
        return <Badge color={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      header: 'Region',
      cell: (d) => <Badge variant="outline">{d.region.toUpperCase()}</Badge>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (d) => (
        <Stack direction="row" justify="end">
          <DomainActions domain={d} />
        </Stack>
      ),
    },
  ];

  const card: SelectionCard<SendingDomainRow> = {
    title: (d) => <Code>{d.domain}</Code>,
    render: (domain) => <DomainCard domain={domain} />,
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(d) => d.id}
      getRowLabel={(d) => d.domain}
      entityLabelPlural="domains"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
