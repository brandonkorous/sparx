import { NavigationMenuLink } from '@sparx/ui';
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

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// Small colored bullet for the megamenu swatches. Bespoke marketing chrome.
function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * The Modules megamenu panel — rendered inside a NavigationMenuContent. Owns its
 * own chrome (surface, border, shadow) in the marketing register; the @sparx/ui
 * NavigationMenu primitive supplies only the behavior.
 *
 * `linkBase` prefixes the marketing routes so the same panel works on the
 * marketing site (relative, '') and on the dashboard auth pages (absolute origin).
 */
export function ModulesMegaContent({ linkBase = '' }: { linkBase?: string }) {
  return (
    <div
      style={{
        width: '680px',
        maxWidth: 'calc(100vw - 48px)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '14px',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '28px',
          padding: '24px',
        }}
      >
        {MODULE_GROUPS.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
                padding: '0 10px 6px',
              }}
            >
              {group.title}
            </span>
            {group.items.map((m) => {
              const c = getModuleColor(m.module);
              return (
                <NavigationMenuLink
                  key={m.module}
                  href={`${linkBase}${m.href}`}
                  className="mkt-mm-item"
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: '7px',
                      backgroundColor: c.tint,
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                  >
                    <Dot color={c.color} size={8} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {m.label}
                    </span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: '12.5px',
                        lineHeight: '16px',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      {m.desc}
                    </span>
                  </span>
                </NavigationMenuLink>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '14px 24px',
          borderTop: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          One platform. Activate only what you need.
        </span>
        <NavigationMenuLink
          href={`${linkBase}/platform`}
          style={{
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '13px',
            color: 'var(--sparx-primary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          See the whole platform →
        </NavigationMenuLink>
      </div>
    </div>
  );
}
