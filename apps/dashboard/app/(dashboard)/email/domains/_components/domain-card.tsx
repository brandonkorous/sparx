'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Code,
  Stack,
  Text,
  type BadgeProps,
} from '@sparx/ui';

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
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={3} className="flex-wrap">
          <Stack direction="row" align="center" gap={2}>
            <Code>{domain.domain}</Code>
            <Badge color={badge.variant}>{badge.label}</Badge>
            {domain.isDefault ? <Badge color="module">Default</Badge> : null}
            <Badge variant="outline">{domain.region.toUpperCase()}</Badge>
          </Stack>
          <DomainActions domain={domain} />
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          <Text size="sm" variant="muted">
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
      </CardContent>
    </Card>
  );
}
