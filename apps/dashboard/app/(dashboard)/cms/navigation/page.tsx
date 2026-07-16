import Link from 'next/link';
import { PageHeader } from '@sparx/ui';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { ArrowRight, Plus } from 'lucide-react';
import { api } from '@/lib/api-rest-client';

// DEPRECATED (docs/57): navigation has moved to the Builder — it's site chrome
// owned by the NavMenu node, authored per site, not CMS content. This surface is
// no longer linked from the CMS sidebar; it stays reachable only by direct URL as
// a dormant rollback net until the verified-in-prod teardown removes it (and the
// navigation_menus / navigation_items tables). Do not wire new entry points to it.

export const dynamic = 'force-dynamic';

// api-rest returns menu items as a flat list spanning every depth; the listing
// only needs top-level counts, so we keep `parentItemId` to filter.
interface NavMenu {
  id: string;
  location: string;
  name: string;
  items: { id: string; parentItemId: string | null }[];
}

const PRESET_LOCATIONS: { location: string; label: string; description: string }[] = [
  { location: 'header', label: 'Header', description: 'Top primary nav.' },
  { location: 'footer', label: 'Footer', description: 'Site-wide footer links.' },
  { location: 'mega', label: 'Mega menu', description: 'Categorised drop-down.' },
];

function topLevelCount(items: NavMenu['items']): number {
  return items.filter((i) => i.parentItemId === null).length;
}

export default async function CmsNavigationPage() {
  const menus = await api.get<NavMenu[]>('/v1/navigation/menus');
  const byLocation = new Map(menus.map((m) => [m.location, m]));
  const customMenus = menus.filter((m) => !PRESET_LOCATIONS.some((p) => p.location === m.location));

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title="Navigation"
          description="Build your menu trees. Site Builder wires them into the header, footer, and announcement bar under its Header & footer settings."
        />

        <div className="grid gap-3">
          {PRESET_LOCATIONS.map(({ location, label, description }) => {
            const existing = byLocation.get(location);
            const count = existing ? topLevelCount(existing.items) : 0;
            return (
              <Card key={location}>
                <CardBody>
                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-row items-center gap-2">
                        <h4 className="text-lg font-semibold">{label}</h4>
                        <code className="text-base-content text-xs">/{location}</code>
                      </div>
                      <p className="text-base-content text-sm">
                        {existing
                          ? `${count} top-level item${count === 1 ? '' : 's'} · ${existing.name}`
                          : description}
                      </p>
                    </div>
                    <Button
                      color="module"
                      size="sm"
                      render={<Link href={`/cms/navigation/${location}`} />}
                    >
                      {existing ? 'Edit' : 'Create'}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {customMenus.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-lg font-semibold">Custom menus</h4>
            <div className="grid gap-2">
              {customMenus.map((m) => (
                <Card key={m.id}>
                  <CardBody>
                    <div className="flex flex-row items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-lg font-semibold">{m.name}</h4>
                        <code className="text-base-content text-xs">/{m.location}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/cms/navigation/${m.location}`} />}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <Button
            color="module"
            variant="outline"
            size="sm"
            iconStart={<Plus className="h-4 w-4" />}
            render={<Link href="/cms/navigation/custom" />}
          >
            New custom menu
          </Button>
        </div>
      </div>
    </div>
  );
}
