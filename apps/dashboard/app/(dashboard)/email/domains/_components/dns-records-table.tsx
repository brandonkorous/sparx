'use client';

import { Code } from '@sparx/ui';
import { Badge, Table } from '@wizeworks/silicaui-react';

import { CopyButton } from './copy-button';
import type { DnsRecord } from '../../_lib/types';

function validBadge(valid: string) {
  if (valid === 'valid')
    return (
      <Badge color="success" variant="soft" size="sm">
        valid
      </Badge>
    );
  if (valid === 'invalid')
    return (
      <Badge color="danger" variant="soft" size="sm">
        invalid
      </Badge>
    );
  return (
    <Badge color="neutral" variant="soft" size="sm">
      unknown
    </Badge>
  );
}

// Renders the exact DNS records the tenant must publish at their registrar.
// Values are shown verbatim (the SPF string in particular must be copied
// exactly — Mailgun's verifier rejects any extra mechanisms).
export function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-base-content text-sm">
        No DNS records yet — they appear once the domain is provisioned.
      </p>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Host / Name</th>
          <th>Value</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={`${r.recordType}-${r.name}-${i}`}>
            <td>
              <Badge color="neutral" variant="soft" size="sm">
                {r.recordType}
              </Badge>
            </td>
            <td>
              <div className="flex flex-row items-center gap-1">
                <Code>{r.name}</Code>
                <CopyButton value={r.name} label="host" />
              </div>
            </td>
            <td>
              <div className="flex flex-row items-center gap-1">
                <Code className="break-all">{r.value}</Code>
                <CopyButton value={r.value} label="value" />
              </div>
            </td>
            <td>{validBadge(r.valid)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
