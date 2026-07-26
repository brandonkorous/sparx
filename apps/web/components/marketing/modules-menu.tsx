import { Badge, NavigationMenuLink, Text } from '@wizeworks/silicaui-react';
import { getModuleColor, type MarketingModule } from './primitives';
import { MODULES, MODULE_ICON } from './modules-catalog';

// The Modules megamenu (desktop) and the mobile drawer accordion. Grouped the
// way the platform reads: what you publish, what you sell, how you grow.
//
// Only the GROUPING lives here — which column each module sits in. Every label,
// blurb, and route is derived from MODULES, because this file used to restate
// all of it by hand and drifted exactly the way modules-catalog.ts's header
// warns about: it listed nine modules, so Invoicing, Inventory and Live Chat
// were unreachable from the header while the pricing switchboard showed twelve.
//
// A typed Record, not a list of lists, so the drift cannot come back: adding a
// module to MarketingModule breaks the build here until it is given a column.
const GROUP_ORDER = ['Content', 'Commerce', 'Accounts & service', 'Growth'] as const;
type ModuleGroup = (typeof GROUP_ORDER)[number];

const MODULE_GROUP: Record<MarketingModule, ModuleGroup> = {
  builder: 'Content',
  cms: 'Content',
  seo: 'Content',
  commerce: 'Commerce',
  invoicing: 'Commerce',
  inventory: 'Commerce',
  dropship: 'Commerce',
  // B2B carries wholesale AND fleet; Scheduling and Live Chat are how you serve
  // an account once you have one. Deliberately NOT named for any one vertical —
  // a "Fleet" column would read as an auto-parts platform to everyone else.
  b2b: 'Accounts & service',
  chat: 'Accounts & service',
  scheduling: 'Accounts & service',
  crm: 'Growth',
  email: 'Growth',
  ai: 'Growth',
  automations: 'Growth',
  social: 'Growth',
};

export interface ModuleNavItem {
  module: MarketingModule;
  label: string;
  href: string;
  desc: string;
  /** Free platform capability (SEO, Automations) — earns a "Free" badge. */
  free: boolean;
}

// Built by walking MODULES, so column order matches the catalog (which in turn
// matches the dashboard sidebar) rather than being restated a third time.
export const MODULE_GROUPS: { title: string; items: ModuleNavItem[] }[] = GROUP_ORDER.map(
  (title) => ({
    title,
    items: MODULES.filter((m) => MODULE_GROUP[m.id] === title).map((m) => ({
      module: m.id,
      label: m.label,
      // Invoicing, Inventory and Live Chat have no marketing page yet, so they
      // point at pricing — the same fallback the footer uses. They still belong
      // in the menu: they are billable modules a visitor can activate.
      href: m.href ?? '/pricing',
      desc: m.title.replace(/\.$/, ''),
      free: m.free ?? false,
    })),
  })
);

// Flat list (drawer accordion + anywhere a single ordered list is handy).
export const MODULE_NAV: ModuleNavItem[] = MODULE_GROUPS.flatMap((g) => g.items);

/**
 * A module's glyph in a neutral square, tinted with the module's hue. Mirrors
 * the dashboard sidebar's `moduleIcon` treatment — the glyph carries the color,
 * the label stays neutral ink — so a module reads the same in the product and
 * in the marketing chrome. Shared by the desktop megamenu and the mobile drawer.
 */
export function ModuleGlyph({ module }: { module: MarketingModule }) {
  const Icon = MODULE_ICON[module];
  return (
    <span className="bg-base-200 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
      <Icon size={15} strokeWidth={2} color={getModuleColor(module).color} aria-hidden />
    </span>
  );
}

/**
 * The Modules megamenu panel — rendered inside a `NavigationMenuContent`,
 * which already supplies the floating panel's surface/border/shadow, so this
 * only lays out the grid of module links.
 */
export function ModulesMegaContent() {
  return (
    <div className="w-[min(920px,calc(100vw-3rem))]">
      <div className="grid grid-cols-4 gap-6 p-6">
        {MODULE_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <Text className="text-base-content px-2.5 pb-1.5 text-xs font-semibold">
              {group.title}
            </Text>
            {group.items.map((m) => (
              <NavigationMenuLink
                key={m.module}
                href={m.href}
                // `h-auto` is load-bearing: silica's `.navigation-menu-link`
                // is styled for BAR items (fixed `height`, centered), which
                // clips these two-line rows so they overlap each other.
                className="rounded-field hover:bg-base-200 flex h-auto items-start gap-3 p-2.5"
              >
                <span className="mt-0.5">
                  <ModuleGlyph module={m.module} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <Text className="text-base-content text-sm font-medium">{m.label}</Text>
                    {m.free ? (
                      <Badge color="success" variant="soft" size="sm">
                        Free
                      </Badge>
                    ) : null}
                  </span>
                  <Text className="text-base-content text-xs leading-snug">{m.desc}</Text>
                </span>
              </NavigationMenuLink>
            ))}
          </div>
        ))}
      </div>

      <div className="border-base-300 bg-base-200 flex items-center justify-between gap-4 border-t px-6 py-3.5">
        <Text className="text-base-content text-sm">
          One platform. Activate only what you need.
        </Text>
        <NavigationMenuLink
          href="/platform"
          className="text-primary h-auto px-0 text-sm font-medium whitespace-nowrap"
        >
          See the whole platform →
        </NavigationMenuLink>
      </div>
    </div>
  );
}
