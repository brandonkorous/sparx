import { Globe, Plus } from 'lucide-react';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, EmptyState } from '@wizeworks/silicaui-react';
import {
  getActivePropertyId,
  listDomains,
  listProperties,
  type Domain,
  type Property,
} from '@/lib/sites';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { SitesList } from './_components/sites-list';

// Settings → Sites: the multi-site (web PROPERTY) management hub (docs/49), on the
// sitewide list substrate ([[list-substrate]]) — `SelectionList` table/cards +
// `ListToolbar` view toggle honoring the user's `defaultListView`, each row an
// `EntityRowLink` into the per-site detail (drawer/modal/full-page per
// `defaultDetailView`). "New site" opens the New-site wizard through the SAME
// surface system via `EntityCreateButton` (blueprint data loads in ./new). Reads
// go through api-rest; all mutations are the server actions in ./actions.ts.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sites · Settings' };

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SitesSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Defensive: a failed read yields empties so the page still renders the create
  // affordance rather than 500-ing.
  const [prefs, properties, domains, activeId] = await Promise.all([
    getUserPreferences(),
    listProperties().catch(() => [] as Property[]),
    listDomains().catch(() => [] as Domain[]),
    getActivePropertyId(),
  ]);

  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';

  const newSiteButton = (
    <EntityCreateButton
      entityType="site"
      newHref="/settings/sites/new"
      color="module"
      leftIcon={<Plus className="h-4 w-4" />}
    >
      New site
    </EntityCreateButton>
  );
  const newSiteButtonToolbar = (
    <EntityCreateButton
      entityType="site"
      newHref="/settings/sites/new"
      color="module"
      size="sm"
      leftIcon={<Plus className="h-4 w-4" />}
    >
      New site
    </EntityCreateButton>
  );

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Globe className="h-5 w-5" />}
          title="Sites"
          badge={
            <Badge color="module">
              {properties.length} site{properties.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Each site is a distinct web property — its own pages, domains, and settings — over your shared back office. Its look & feel is set on the Brand page."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar enableViewToggle searchable={false} primaryAction={newSiteButtonToolbar} />
      }
    >
      {properties.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-5 w-5" />}
          title="No sites yet"
          description="Spin up your first site — blank or from a blueprint — over your shared back office."
          actions={newSiteButton}
        />
      ) : (
        <SitesList sites={properties} domains={domains} activePropertyId={activeId} view={view} />
      )}
    </ListPageShell>
  );
}
