'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Stack,
  Text,
  toast,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { ArrowRight, Building2 } from 'lucide-react';
import { switchOrganization } from '@/lib/org-actions';

import type { PartnerClient } from '../../_lib/types';

// The partner's client book (docs/114 §B.7) — a card per account showing how the
// partner is tied to it (Referred / Managed) and its referral lifecycle. A managed
// account (the operator holds consultant access) gets an "Enter" action that
// switches the active workspace into that client's org; a referral-only account
// has no access, so it's labelled as such rather than offering a dead button.

export function PartnerClientsList({ clients }: { clients: PartnerClient[] }) {
  return (
    <Stack gap={3}>
      {clients.map((c) => (
        <ClientRow key={c.orgId} client={c} />
      ))}
    </Stack>
  );
}

function ClientRow({ client }: { client: PartnerClient }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
          <Stack direction="row" align="center" gap={3} className="min-w-0">
            <Avatar size="lg" shape="square" aria-hidden>
              <Building2 className="h-5 w-5" />
            </Avatar>
            <Stack gap={1} className="min-w-0">
              <Text weight="medium" className="truncate">
                {client.name}
              </Text>
              <Stack direction="row" align="center" gap={2} className="flex-wrap">
                {client.referred ? (
                  <Badge color="module" variant="soft" size="sm">
                    Referred
                  </Badge>
                ) : null}
                {client.managed ? (
                  <Badge color="success" variant="soft" size="sm">
                    Managed
                  </Badge>
                ) : null}
                {client.referralStatus ? (
                  <Badge color={statusTone(client.referralStatus)} variant="soft" size="sm">
                    {statusLabel(client.referralStatus)}
                  </Badge>
                ) : null}
                {client.commissionType === 'ongoing' ? (
                  <Text size="xs" variant="muted">
                    5% ongoing
                  </Text>
                ) : null}
              </Stack>
            </Stack>
          </Stack>
          {client.managed ? (
            <EnterButton orgId={client.orgId} name={client.name} />
          ) : (
            <Text size="sm" variant="muted">
              Referred — no direct access
            </Text>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function EnterButton({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onEnter() {
    startTransition(async () => {
      const result = await switchOrganization(orgId);
      if (result.ok) {
        router.push('/');
      } else {
        toast.error(result.error ?? `Could not enter ${name}.`);
      }
    });
  }

  return (
    <Button variant="outline" onClick={onEnter} loading={pending} disabled={pending}>
      Enter
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
