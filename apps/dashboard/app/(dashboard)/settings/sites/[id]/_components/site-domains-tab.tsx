'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Globe, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Code,
  Heading,
  Input,
  Label,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import type { Domain } from '@/lib/sites';
import {
  connectDomain,
  deleteDomain,
  setDomainCanonical,
  verifyDomain,
  type ActionResult,
} from '../../actions';
import { domainStatusBadge } from '../../_lib';

// Domains tab of the site detail — the addresses that reach THIS site. Connect a
// custom domain (returns DNS records to add, then verify), pick the primary
// domain, and disconnect. Ported from the old inline SitesManager, scoped to one
// site. "Make canonical" → "Set as primary domain" (plain language); only the
// canonical domain wears the "Primary domain" badge (not every row).

export function SiteDomainsTab({ propertyId, domains }: { propertyId: string; domains: Domain[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (action: () => Promise<ActionResult>, success?: string) => {
      startTransition(async () => {
        const res = await action();
        if (res.ok) {
          if (success) toast.success(success);
          router.refresh();
        } else {
          toast.error(res.error ?? 'Something went wrong.');
        }
      });
    },
    [router]
  );

  function onConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('propertyId', propertyId);
    run(() => connectDomain(fd), 'Domain added — add the DNS records below, then verify.');
    form.reset();
  }

  async function onDisconnect(d: Domain) {
    const ok = await confirm({
      title: `Disconnect ${d.host}?`,
      description: "Traffic to this domain will stop resolving to your site. This can't be undone.",
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    run(() => deleteDomain(d.id), `${d.host} disconnected.`);
  }

  return (
    <Stack gap={4}>
      <Card variant="default">
        <CardHeader>
          <Heading level={3}>Domains</Heading>
          <CardDescription>
            Where people reach this site. The primary domain is what appears in links and emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            {domains.length === 0 && (
              <Text size="sm" variant="muted">
                No domains yet — connect one you own below.
              </Text>
            )}

            {domains.map((d) => {
              const status = domainStatusBadge(d);
              const isActive = d.status === 'active' || d.status === 'verified';
              const isCustom = d.type === 'custom';
              const isSubdomain = d.type === 'subdomain';
              return (
                <div
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-default)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Globe className="size-4 text-[var(--color-text-secondary)]" />
                    <span className="font-medium">{d.host}</span>
                    <Badge color={status.color} variant="soft" size="sm">
                      {status.label}
                    </Badge>
                    {d.isCanonical && (
                      <Badge color="module" variant="soft" size="sm">
                        <Star className="size-3" /> Primary domain
                      </Badge>
                    )}
                    <div className="ml-auto flex gap-1">
                      {isCustom && !isActive && (
                        <Button
                          size="sm"
                          variant="soft"
                          color="module"
                          disabled={pending}
                          onClick={() => run(() => verifyDomain(d.id), `${d.host} verified.`)}
                          leftIcon={<RefreshCw className="size-3.5" />}
                        >
                          Verify
                        </Button>
                      )}
                      {isActive && !d.isCanonical && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setDomainCanonical(d.id),
                              `${d.host} is now the primary domain.`
                            )
                          }
                          leftIcon={<CheckCircle2 className="size-3.5" />}
                        >
                          Set as primary
                        </Button>
                      )}
                      {!isSubdomain && (
                        <Button
                          size="sm"
                          variant="ghost"
                          color="danger"
                          disabled={pending}
                          aria-label={`Disconnect ${d.host}`}
                          onClick={() => void onDisconnect(d)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {d.instructions && (
                    <div className="mt-1 grid gap-1 text-sm">
                      <Text size="sm" variant="muted">
                        Add these DNS records at your registrar, then click Verify:
                      </Text>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <span className="text-[var(--color-text-secondary)]">CNAME</span>
                        <Code>
                          {d.instructions.cname.name} → {d.instructions.cname.value}
                        </Code>
                        {d.instructions.txt && (
                          <>
                            <span className="text-[var(--color-text-secondary)]">TXT</span>
                            <Code>
                              {d.instructions.txt.name} = {d.instructions.txt.value}
                            </Code>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <form
              onSubmit={onConnect}
              className="flex flex-col gap-2 border-t border-[var(--color-border-default)] pt-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Label htmlFor="connect-host">Connect a domain you own</Label>
                <Input id="connect-host" name="host" placeholder="shop.yourbrand.com" />
              </div>
              <Button
                type="submit"
                variant="soft"
                color="module"
                disabled={pending}
                leftIcon={<Plus className="size-4" />}
              >
                Connect
              </Button>
            </form>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
