'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Globe, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { toast, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import type { Domain } from '@/lib/sites';
import {
  connectDomain,
  deleteDomain,
  reissueVerification,
  setDomainCanonical,
  verifyDomain,
  type ActionResult,
} from '../../actions';
import { domainStatusBadge } from '../../_lib';
import { DomainDnsInstructions } from './domain-dns-instructions';

// Domains tab of the site detail — the addresses that reach THIS site. Connect a
// custom domain (returns DNS records to add, then verify), pick the primary
// domain, and disconnect. Ported from the old inline SitesManager, scoped to one
// site. "Make canonical" → "Set as primary domain" (plain language); only the
// canonical domain wears the "Primary domain" badge (not every row).

export function SiteDomainsTab({ propertyId, domains }: { propertyId: string; domains: Domain[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [host, setHost] = React.useState('');

  const v = useFieldValidation(
    { host },
    { host: rule.required('Enter the domain you want to connect.') }
  );

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
    if (!v.validate()) return;
    const fd = new FormData();
    fd.set('propertyId', propertyId);
    fd.set('host', host.trim());
    run(() => connectDomain(fd), 'Domain added — add the DNS records below, then verify.');
    setHost('');
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Domains</h3>
          <p className="opacity-70">
            Where people reach this site. The primary domain is what appears in links and emails.
          </p>
          <div className="flex flex-col gap-3">
            {domains.length === 0 && (
              <p className="text-base-content/70 text-sm">
                No domains yet — connect one you own below.
              </p>
            )}

            {domains.map((d) => {
              const status = domainStatusBadge(d);
              const isActive = d.status === 'active' || d.status === 'verified';
              const isCustom = d.type === 'custom';
              const isSubdomain = d.type === 'subdomain';
              // Verify is available while unverified — and again after a fresh
              // verification token is issued for an already-connected domain.
              const canVerify = isCustom && (!isActive || Boolean(d.instructions?.txt));
              const canSetPrimary = isActive && !d.isCanonical;
              const canDisconnect = !isSubdomain;
              // Second row exists only when there's a badge or an action to show,
              // so a bare-subdomain row doesn't leave an empty gap.
              const hasMetaRow = d.isCanonical || canVerify || canSetPrimary || canDisconnect;
              return (
                <div
                  key={d.id}
                  className="border-base-300 flex flex-col gap-2 rounded-lg border p-3"
                >
                  {/* Host owns its own line (+ status), so a long domain never has to
                      share a row with the actions and wrap awkwardly. */}
                  <div className="flex items-center gap-2">
                    <Globe className="text-base-content/70 size-4 shrink-0" />
                    <span className="min-w-0 font-medium break-all">{d.host}</span>
                    <Badge color={status.color} variant="soft" size="sm" className="shrink-0">
                      {status.label}
                    </Badge>
                  </div>

                  {/* Primary-domain badge + actions on their own row. */}
                  {hasMetaRow && (
                    <div className="flex flex-wrap items-center gap-2">
                      {d.isCanonical && (
                        <Badge color="module" variant="soft" size="sm">
                          <Star className="size-3" /> Primary domain
                        </Badge>
                      )}
                      <div className="ml-auto flex gap-1">
                        {canVerify && (
                          <Button
                            size="sm"
                            variant="soft"
                            color="module"
                            disabled={pending}
                            onClick={() => run(() => verifyDomain(d.id), `${d.host} verified.`)}
                            iconStart={<RefreshCw className="size-3.5" />}
                          >
                            Verify
                          </Button>
                        )}
                        {canSetPrimary && (
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
                            iconStart={<CheckCircle2 className="size-3.5" />}
                          >
                            Set as primary
                          </Button>
                        )}
                        {canDisconnect && (
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
                  )}

                  <DomainDnsInstructions
                    domain={d}
                    onReverify={() =>
                      run(
                        () => reissueVerification(d.id),
                        'New verification record ready — add it below, then press Verify.'
                      )
                    }
                    verifying={pending}
                  />
                </div>
              );
            })}

            <form
              onSubmit={onConnect}
              noValidate
              className="border-base-300 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end"
            >
              <Field {...v.field('host')} className="flex-1">
                <FieldLabel required>Connect a domain you own</FieldLabel>
                <FieldControl
                  name="host"
                  placeholder="shop.yourbrand.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  {...v.control('host')}
                />
              </Field>
              <Button
                type="submit"
                variant="soft"
                color="module"
                disabled={pending}
                iconStart={<Plus className="size-4" />}
              >
                Connect
              </Button>
            </form>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
