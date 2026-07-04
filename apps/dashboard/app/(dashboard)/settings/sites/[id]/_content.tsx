import { notFound } from 'next/navigation';
import { Globe, Layers, Settings as SettingsIcon, Star } from 'lucide-react';
import { Badge, TabsContent, TabsList, TabsTrigger } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getActivePropertyId, listDomains, listProperties, type Domain } from '@/lib/sites';
import { resolveActiveProperty } from '@/lib/site-scope';

import { DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { GuardedTabs } from '../../../_components/guarded-tabs';

import { primaryDomainOf, siteStatusBadge } from '../_lib';
import { SiteLifecycleActions } from './_components/site-lifecycle-actions';
import { SiteGeneralTab } from './_components/site-general-tab';
import { SiteDomainsTab } from './_components/site-domains-tab';
import { SiteModulesTab } from './_components/site-modules-tab';

// The per-site management detail body — General / Domains / Modules. This SAME
// server component mounts in the drawer, the modal, or the full-page shell
// (docs/86), chosen by the user's `defaultDetailView`; the surrounding chrome
// owns the header bar, into which the status badges + lifecycle actions teleport
// (`DetailHeaderSlot`). Identity (name/handle) lives ONLY in the General tab's
// editable fields — never restated as an in-body heading. This is a MANAGEMENT
// surface: look & branding live on the Brand page, linked from General.

export const dynamic = 'force-dynamic';

export async function SiteDetailContent({ id }: { id: string }) {
  const [properties, domains, activeId, tenant] = await Promise.all([
    listProperties().catch(() => []),
    listDomains().catch(() => [] as Domain[]),
    getActivePropertyId(),
    api.get<{ slug: string }>('/v1/tenant').catch(() => ({ slug: 'your-store' })),
  ]);

  const property = properties.find((p) => p.id === id);
  if (!property) notFound();

  const siteDomains = domains.filter((d) => d.propertyId === id);
  const isActive = resolveActiveProperty(properties, activeId)?.id === id;
  const primaryHost = primaryDomainOf(siteDomains)?.host ?? null;
  const status = siteStatusBadge(property);

  return (
    <>
      <DetailHeaderSlot>
        {property.isPrimary && (
          <Badge color="module" variant="soft">
            <Star className="mr-1 h-3 w-3" />
            Primary
          </Badge>
        )}
        {isActive && (
          <Badge color="success" variant="soft">
            Editing now
          </Badge>
        )}
        <Badge color={status.color} variant="soft">
          {status.label}
        </Badge>
        <SiteLifecycleActions
          propertyId={property.id}
          name={property.name}
          isActive={isActive}
          isPrimary={property.isPrimary}
          host={primaryHost}
        />
      </DetailHeaderSlot>

      <GuardedTabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <SettingsIcon className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Globe className="mr-2 h-4 w-4" />
            Domains
            <Badge variant="soft" size="sm" className="ml-2">
              {siteDomains.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="modules">
            <Layers className="mr-2 h-4 w-4" />
            Modules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SiteGeneralTab
            propertyId={property.id}
            name={property.name}
            slug={property.slug}
            isPrimary={property.isPrimary}
            status={status}
            createdAt={property.createdAt}
            primaryHost={primaryHost}
            zoneSuffix={`${tenant.slug}.sparx.zone`}
          />
        </TabsContent>

        <TabsContent value="domains">
          <SiteDomainsTab propertyId={property.id} domains={siteDomains} />
        </TabsContent>

        <TabsContent value="modules">
          <SiteModulesTab propertyId={property.id} moduleScope={property.moduleScope} />
        </TabsContent>
      </GuardedTabs>
    </>
  );
}
