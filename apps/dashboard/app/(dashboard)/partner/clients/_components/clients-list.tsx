'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { toast, statusLabel, statusTone } from '@sparx/ui';
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
    <div className="flex flex-col gap-3">
      {clients.map((c) => (
        <ClientRow key={c.orgId} client={c} />
      ))}
    </div>
  );
}

function ClientRow({ client }: { client: PartnerClient }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-row items-center gap-3">
            <Avatar size="lg" shape="rounded" aria-hidden>
              <Building2 className="h-5 w-5" />
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate text-base font-medium">{client.name}</p>
              <div className="flex flex-row flex-wrap items-center gap-2">
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
                  <p className="text-base-content text-xs">5% ongoing</p>
                ) : null}
              </div>
            </div>
          </div>
          {client.managed ? (
            <EnterButton orgId={client.orgId} name={client.name} />
          ) : (
            <p className="text-base-content text-sm">Referred — no direct access</p>
          )}
        </div>
      </CardBody>
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
    <Button
      variant="outline"
      onClick={onEnter}
      loading={pending}
      disabled={pending}
      iconEnd={<ArrowRight className="h-4 w-4" />}
    >
      Enter
    </Button>
  );
}
