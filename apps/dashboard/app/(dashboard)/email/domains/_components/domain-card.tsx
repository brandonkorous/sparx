'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Code, type BadgeProps } from '@sparx/ui';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';

import { DnsRecordsTable } from './dns-records-table';
import { DomainActions } from './domain-actions';
import type { SendingDomainRow } from '../../_lib/types';

export const STATE_BADGE: Record<
  SendingDomainRow['state'],
  { variant: BadgeProps['color']; label: string }
> = {
  verified: { variant: 'success', label: 'Verified' },
  pending: { variant: 'outline', label: 'Pending DNS' },
  verifying: { variant: 'warning', label: 'Verifying' },
  failed: { variant: 'danger', label: 'Failed' },
  disabled: { variant: 'default', label: 'Disabled' },
};

export const STATE_HINT: Record<SendingDomainRow['state'], string> = {
  pending: 'Add the DNS records below at your registrar, then click Verify.',
  verifying:
    'DNS records not detected yet — propagation can take up to 48 hours. Verify again later.',
  verified: 'This domain is verified and ready to send.',
  failed: 'Verification failed. Double-check the records match exactly, then verify again.',
  disabled: 'This domain is disabled.',
};

export function DomainCard({ domain }: { domain: SendingDomainRow }) {
  const [open, setOpen] = useState(domain.state !== 'verified');
  const badge = STATE_BADGE[domain.state];

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row items-center gap-2">
            <Code>{domain.domain}</Code>
            <Badge color={badge.variant} variant="soft" size="sm">
              {badge.label}
            </Badge>
            {domain.isDefault ? (
              <Badge color="module" variant="soft" size="sm">
                Default
              </Badge>
            ) : null}
            <Badge color="neutral" variant="soft" size="sm">
              {domain.region.toUpperCase()}
            </Badge>
          </div>
          <DomainActions domain={domain} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-base-content/70 text-sm">{STATE_HINT[domain.state]}</p>
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
        </div>
      </CardBody>
    </Card>
  );
}
