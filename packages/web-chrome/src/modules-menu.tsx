import { NavigationMenuLink, Text } from '@wizeworks/silicaui-react';
import { getModuleColor, type MarketingModule } from './module-colors';

// Source of truth for the Modules megamenu (desktop) and the mobile drawer
// accordion. Grouped the way the platform reads: what you publish, what you
// sell, how you grow. Each links to its module marketing page.
export interface ModuleNavItem {
  module: MarketingModule;
  label: string;
  href: string;
  desc: string;
}

export const MODULE_GROUPS: { title: string; items: ModuleNavItem[] }[] = [
  {
    title: 'Content',
    items: [
      { module: 'builder', label: 'Builder', href: '/builder', desc: 'Themes, pages, live URLs' },
      { module: 'cms', label: 'CMS', href: '/cms', desc: 'Words, media, structured content' },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { module: 'commerce', label: 'Commerce', href: '/commerce', desc: 'Cart, checkout, orders' },
      { module: 'b2b', label: 'B2B', href: '/b2b', desc: 'Accounts, net terms, fleet' },
      {
        module: 'dropship',
        label: 'Dropship',
        href: '/dropship',
        desc: 'Suppliers, sync, fulfillment',
      },
      {
        module: 'scheduling',
        label: 'Scheduling',
        href: '/scheduling',
        desc: 'Appointments, classes, bookings',
      },
    ],
  },
  {
    title: 'Growth',
    items: [
      { module: 'crm', label: 'CRM', href: '/crm', desc: 'Contacts, pipeline, segments' },
      { module: 'email', label: 'Email', href: '/email', desc: 'Transactional + marketing' },
      { module: 'ai', label: 'AI / MCP', href: '/ai', desc: 'An MCP server for your data' },
    ],
  },
];

// Flat list (drawer accordion + anywhere a single ordered list is handy).
export const MODULE_NAV: ModuleNavItem[] = MODULE_GROUPS.flatMap((g) => g.items);

/**
 * The Modules megamenu panel — rendered inside a `NavigationMenuContent`,
 * which already supplies the floating panel's surface/border/shadow, so this
 * only lays out the grid of module links. `linkBase` prefixes the marketing
 * routes so the same panel works on the marketing site (relative, '') and on
 * the dashboard auth pages (absolute origin).
 */
export function ModulesMegaContent({ linkBase = '' }: { linkBase?: string }) {
  return (
    <div className="w-[min(680px,calc(100vw-3rem))]">
      <div className="grid grid-cols-3 gap-7 p-6">
        {MODULE_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <Text className="text-base-content/50 px-2.5 pb-1.5 text-xs font-semibold">
              {group.title}
            </Text>
            {group.items.map((m) => {
              const c = getModuleColor(m.module);
              return (
                <NavigationMenuLink
                  key={m.module}
                  href={`${linkBase}${m.href}`}
                  className="rounded-field hover:bg-base-200 flex items-start gap-3 p-2.5"
                >
                  <span className="bg-base-200 mt-0.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <Text className="text-base-content text-sm font-medium">{m.label}</Text>
                    <Text className="text-base-content/50 text-xs leading-snug">{m.desc}</Text>
                  </span>
                </NavigationMenuLink>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-base-300 bg-base-200 flex items-center justify-between gap-4 border-t px-6 py-3.5">
        <Text className="text-base-content/70 text-sm">
          One platform. Activate only what you need.
        </Text>
        <NavigationMenuLink
          href={`${linkBase}/platform`}
          className="text-primary text-sm font-medium whitespace-nowrap"
        >
          See the whole platform →
        </NavigationMenuLink>
      </div>
    </div>
  );
}
