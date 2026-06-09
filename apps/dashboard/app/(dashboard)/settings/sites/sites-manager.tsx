'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Code,
  Input,
  Label,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { CheckCircle2, Globe, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import type { Domain, Property } from '@/lib/sites';
import {
  connectDomain,
  createSite,
  deleteDomain,
  deleteSite,
  makeSitePrimary,
  setActiveSite,
  setDomainCanonical,
  updateBrandOverride,
  verifyDomain,
  type ActionResult,
} from './actions';

export interface SitesManagerProps {
  properties: Property[];
  domains: Domain[];
  activePropertyId: string | null;
}

// The status of a custom domain → a Badge color. Subdomains are always live.
function statusColor(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active' || status === 'verified') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending' || status === 'verifying') return 'warning';
  return 'neutral';
}

export function SitesManager({ properties, domains, activePropertyId }: SitesManagerProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [creating, setCreating] = React.useState(false);

  // The site the Builder is currently authoring: the cookie's id if it still
  // names a property, else the primary (mirrors lib/sites.getActiveProperty).
  const primary = properties.find((p) => p.isPrimary);
  const effectiveActiveId =
    (activePropertyId && properties.some((p) => p.id === activePropertyId)
      ? activePropertyId
      : undefined) ??
    primary?.id ??
    properties[0]?.id;

  const domainsByProperty = React.useMemo(() => {
    const map = new Map<string, Domain[]>();
    for (const d of domains) {
      const list = map.get(d.propertyId) ?? [];
      list.push(d);
      map.set(d.propertyId, list);
    }
    return map;
  }, [domains]);

  // Run a server action inside a transition, toast the result, and refresh so the
  // server-rendered list reflects the change.
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

  const onCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(() => createSite(fd), "Site created — you're now editing it.");
    form.reset();
    setCreating(false);
  };

  const onConnect = (e: React.FormEvent<HTMLFormElement>, propertyId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('propertyId', propertyId);
    run(() => connectDomain(fd), 'Domain added — now add the DNS records below, then verify.');
    form.reset();
  };

  const onSaveBrand = (e: React.FormEvent<HTMLFormElement>, propertyId: string) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('propertyId', propertyId);
    run(() => updateBrandOverride(fd), 'Brand override saved.');
  };

  const onDeleteSite = async (property: Property) => {
    const domainCount = (domainsByProperty.get(property.id) ?? []).length;
    const ok = await confirm({
      title: `Delete “${property.name}”?`,
      description: `This permanently removes this site — its pages, layout, and ${domainCount} domain${domainCount === 1 ? '' : 's'}. Your products, content, and orders are not affected. This can't be undone.`,
      confirmLabel: 'Delete site',
      tone: 'danger',
    });
    if (!ok) return;
    run(() => deleteSite(property.id), `“${property.name}” deleted.`);
  };

  const onDisconnect = async (d: Domain) => {
    const ok = await confirm({
      title: `Disconnect ${d.host}?`,
      description: "Traffic to this domain will stop resolving to your site. This can't be undone.",
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    run(() => deleteDomain(d.id), 'Domain disconnected.');
  };

  return (
    <Stack gap={6}>
      {/* Create a site */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Your sites</CardTitle>
          {!creating && (
            <Button color="primary" variant="soft" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New site
            </Button>
          )}
        </CardHeader>
        {creating && (
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="new-site-name">Site name</Label>
                <Input id="new-site-name" name="name" placeholder="Wholesale Portal" required />
              </div>
              <div className="flex-1">
                <Label htmlFor="new-site-slug">URL handle (optional)</Label>
                <Input id="new-site-slug" name="slug" placeholder="wholesale" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" color="primary" disabled={pending}>
                  Create
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
            <Text size="sm" variant="muted" className="mt-2">
              A new site gets its own <Code>handle.yourstore.sparx.zone</Code> address instantly.
              Connect your own domain below once it's created.
            </Text>
          </CardContent>
        )}
      </Card>

      {/* Per-site cards */}
      {properties.map((property) => {
        const isActive = property.id === effectiveActiveId;
        const propDomains = domainsByProperty.get(property.id) ?? [];
        return (
          <Card key={property.id} variant={isActive ? 'module' : 'default'}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{property.name}</CardTitle>
                {property.isPrimary && (
                  <Badge color="primary" variant="soft">
                    <Star className="size-3" /> Primary
                  </Badge>
                )}
                {isActive && (
                  <Badge color="success" variant="soft">
                    Editing now
                  </Badge>
                )}
                {property.status !== 'active' && (
                  <Badge color="neutral" variant="soft">
                    {property.status}
                  </Badge>
                )}
              </div>
              <Text size="sm" variant="muted">
                Handle: <Code>{property.slug}</Code>
              </Text>
            </CardHeader>

            <CardContent>
              <Stack gap={4}>
                {/* Domains */}
                <Stack gap={2}>
                  {propDomains.length === 0 && (
                    <Text size="sm" variant="muted">
                      No domains yet.
                    </Text>
                  )}
                  {propDomains.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Globe className="size-4 text-[var(--muted-foreground)]" />
                        <span className="font-medium">{d.host}</span>
                        <Badge color={statusColor(d.status)} variant="soft">
                          {d.type === 'subdomain' ? 'live' : d.status}
                        </Badge>
                        {d.isCanonical && (
                          <Badge color="neutral" variant="outline">
                            canonical
                          </Badge>
                        )}
                        <div className="ml-auto flex gap-1">
                          {d.type === 'custom' &&
                            d.status !== 'active' &&
                            d.status !== 'verified' && (
                              <Button
                                size="sm"
                                variant="soft"
                                color="primary"
                                disabled={pending}
                                onClick={() => run(() => verifyDomain(d.id), `${d.host} verified.`)}
                              >
                                <RefreshCw className="size-3.5" /> Verify
                              </Button>
                            )}
                          {(d.status === 'active' || d.status === 'verified') && !d.isCanonical && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                run(() => setDomainCanonical(d.id), `${d.host} is now canonical.`)
                              }
                            >
                              <CheckCircle2 className="size-3.5" /> Make canonical
                            </Button>
                          )}
                          {d.type !== 'subdomain' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              color="danger"
                              disabled={pending}
                              onClick={() => void onDisconnect(d)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* DNS records to add for an unverified custom domain */}
                      {d.instructions && (
                        <div className="mt-1 grid gap-1 text-sm">
                          <Text size="sm" variant="muted">
                            Add these DNS records at your registrar, then click Verify:
                          </Text>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <span className="text-[var(--muted-foreground)]">CNAME</span>
                            <Code>
                              {d.instructions.cname.name} → {d.instructions.cname.value}
                            </Code>
                            {d.instructions.txt && (
                              <>
                                <span className="text-[var(--muted-foreground)]">TXT</span>
                                <Code>
                                  {d.instructions.txt.name} = {d.instructions.txt.value}
                                </Code>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </Stack>

                {/* Connect a custom domain */}
                <form
                  onSubmit={(e) => onConnect(e, property.id)}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <Label htmlFor={`host-${property.id}`}>Connect a domain you own</Label>
                    <Input
                      id={`host-${property.id}`}
                      name="host"
                      placeholder="shop.yourbrand.com"
                    />
                  </div>
                  <Button type="submit" variant="soft" disabled={pending}>
                    Connect
                  </Button>
                </form>

                {/* Per-site brand + presentation override (docs/49 §3, Slice B) —
                    collapsed by default; blank fields inherit the tenant brand. */}
                <details className="rounded-md border border-[var(--border)] p-3">
                  <summary className="cursor-pointer text-sm font-medium select-none">
                    Site presentation{property.brandOverride ? ' · on' : ''}
                  </summary>
                  <form
                    onSubmit={(e) => onSaveBrand(e, property.id)}
                    className="mt-3 flex flex-col gap-4"
                  >
                    <Text size="sm" variant="muted">
                      Override this site's identity, typography, and surface colours. Leave any
                      field blank to inherit from your tenant brand or theme.
                    </Text>

                    {/* Identity */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        Identity
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label htmlFor={`bn-${property.id}`}>Display name</Label>
                          <Input
                            id={`bn-${property.id}`}
                            name="businessName"
                            defaultValue={property.brandOverride?.businessName ?? ''}
                            placeholder="Wholesale Co."
                          />
                        </div>
                        <div>
                          <Label htmlFor={`cp-${property.id}`}>Primary colour</Label>
                          <Input
                            id={`cp-${property.id}`}
                            name="colorPrimary"
                            defaultValue={property.brandOverride?.colorPrimary ?? ''}
                            placeholder="#6366F1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ca-${property.id}`}>Accent colour</Label>
                          <Input
                            id={`ca-${property.id}`}
                            name="colorAccent"
                            defaultValue={property.brandOverride?.colorAccent ?? ''}
                            placeholder="#F59E0B"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Typography */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        Typography
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`fh-${property.id}`}>Heading font</Label>
                          <Input
                            id={`fh-${property.id}`}
                            name="fontHeading"
                            defaultValue={property.brandOverride?.fontHeading ?? ''}
                            placeholder="Inter"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`fb-${property.id}`}>Body font</Label>
                          <Input
                            id={`fb-${property.id}`}
                            name="fontBody"
                            defaultValue={property.brandOverride?.fontBody ?? ''}
                            placeholder="Inter"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Presentation */}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        Surfaces
                      </p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <Label htmlFor={`cbg-${property.id}`}>Background</Label>
                          <Input
                            id={`cbg-${property.id}`}
                            name="colorBackground"
                            defaultValue={property.brandOverride?.colorBackground ?? ''}
                            placeholder="#ffffff"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`cm-${property.id}`}>Muted</Label>
                          <Input
                            id={`cm-${property.id}`}
                            name="colorMuted"
                            defaultValue={property.brandOverride?.colorMuted ?? ''}
                            placeholder="#f8f9fa"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`cb-${property.id}`}>Border</Label>
                          <Input
                            id={`cb-${property.id}`}
                            name="colorBorder"
                            defaultValue={property.brandOverride?.colorBorder ?? ''}
                            placeholder="#e2e8f0"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`rb-${property.id}`}>Border radius</Label>
                          <Input
                            id={`rb-${property.id}`}
                            name="radiusBase"
                            defaultValue={property.brandOverride?.radiusBase ?? ''}
                            placeholder="0.5rem"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-[var(--border)] pt-3">
                      <Button type="submit" variant="soft" size="sm" disabled={pending}>
                        Save site presentation
                      </Button>
                    </div>
                  </form>
                </details>

                {/* Site-level actions */}
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  {isActive ? (
                    <Button variant="soft" color="success" disabled>
                      <CheckCircle2 className="size-4" /> Editing this site
                    </Button>
                  ) : (
                    <Button
                      color="primary"
                      disabled={pending}
                      onClick={() =>
                        run(() => setActiveSite(property.id), `Now editing “${property.name}”.`)
                      }
                    >
                      Switch to this site
                    </Button>
                  )}
                  {!property.isPrimary && (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => makeSitePrimary(property.id),
                          `“${property.name}” is now primary.`
                        )
                      }
                    >
                      <Star className="size-4" /> Make primary
                    </Button>
                  )}
                  {!property.isPrimary && (
                    <Button
                      variant="ghost"
                      color="danger"
                      disabled={pending}
                      onClick={() => void onDeleteSite(property)}
                    >
                      <Trash2 className="size-4" /> Delete site
                    </Button>
                  )}
                </div>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
