import { Badge, Footer as SilicaFooter, FooterTitle, Link, Text } from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/ui';
import type { MarketingModule } from './primitives';
import { MODULE_HEX } from './modules-catalog';

/**
 * Site footer — rebuilt on silicaui's real `Footer`/`FooterTitle`/`Link`
 * layout components (not a plain `<footer>` + hand-rolled flex, which was
 * the first pass at this and missed the actual layout primitive). Two
 * sibling `<Footer>` elements — link columns, then the domain/copyright bar
 * — mirrors daisyUI's own documented "main footer + legal bar" pattern
 * (nesting a second `<footer>` inside the first isn't valid HTML). Content
 * (columns, links, domain list, copyright) is unchanged. Domain dot colors
 * reference the shared `MODULE_HEX` map instead of re-typed hex literals.
 */
interface FooterLink {
    label: string;
    href: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
    {
        title: 'Modules',
        links: [
            { label: 'Builder', href: '/builder' },
            { label: 'Commerce', href: '/commerce' },
            { label: 'CMS', href: '/cms' },
            { label: 'CRM', href: '/crm' },
            { label: 'Email', href: '/email' },
            { label: 'B2B / Wholesale', href: '/b2b' },
            { label: 'AI / MCP', href: '/ai' },
            { label: 'Dropship', href: '/dropship' },
            { label: 'Scheduling', href: '/scheduling' },
            // No dedicated page yet — point at the pricing switchboard until one ships.
            { label: 'Invoicing', href: '/pricing' },
            { label: 'Inventory', href: '/pricing' },
            { label: 'Live Chat', href: '/pricing' },
        ],
    },
    {
        title: 'Platform',
        links: [
            { label: 'Features', href: '/features' },
            { label: 'Early access', href: '/early' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'Free tools', href: '/tools' },
            { label: 'Themes', href: '/market/themes' },
            { label: 'Marketplace', href: '/market' },
            { label: 'Managed hosting', href: '/hosting' },
            { label: 'Enterprise', href: '/enterprise' },
            { label: 'Migration tools', href: '/migrate' },
            { label: 'Changelog', href: '/changelog' },
        ],
    },
    {
        title: 'Developers',
        // Docs are first-class on sparx.works/docs (the canonical developer home) —
        // sparx.software 301s here. Only live routes are linked; the rest of the IA
        // (GraphQL, MCP, SDK, self-host) is visible in the docs sidebar as upcoming.
        links: [
            { label: 'Documentation', href: '/docs' },
            { label: 'Quickstart', href: '/docs/quickstart' },
            { label: 'API reference', href: '/docs/api/orders/create' },
            { label: 'Changelog', href: '/changelog' },
            { label: 'Open source', href: '/open-source' },
        ],
    },
    {
        title: 'Partners',
        links: [
            { label: 'Partner program', href: '/partners' },
            { label: 'Partner directory', href: '/partners/directory' },
            { label: 'Business OS Bootcamp', href: '/bootcamp' },
            { label: 'Become a partner', href: '/partners#apply' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About WizeWorks', href: '/about' },
            { label: 'Customers', href: '/customers' },
            { label: 'Brand', href: '/brand' },
            { label: 'Press', href: '/press' },
            { label: 'Careers', href: '/careers' },
            { label: 'Contact', href: '/contact' },
        ],
    },
    {
        title: 'Legal & trust',
        links: [
            { label: 'Terms of service', href: '/legal/terms' },
            { label: 'Privacy policy', href: '/legal/privacy' },
            { label: 'Data processing', href: '/legal/dpa' },
            { label: 'Security & SOC 2', href: '/security' },
            { label: 'Status & SLA', href: 'https://status.sparx.works' },
            { label: 'Acceptable use', href: '/legal/aup' },
        ],
    },
];

const DOMAINS: { name: string; module?: MarketingModule; primary?: boolean }[] = [
    { name: 'sparx.works', module: 'builder', primary: true },
    { name: 'sparx.zone', module: 'builder' },
    { name: 'sparxcms.com', module: 'cms' },
    { name: 'sparxcrm.com', module: 'crm' },
    { name: 'sparxemail.com', module: 'email' },
    { name: 'sparxb2b.com', module: 'b2b' },
    { name: 'sparx.email' },
    { name: 'sparx.host' },
    { name: 'sparx.software' },
    { name: 'sparx.exchange' },
    { name: 'sparx.market' },
];

const LINK_CLASS = 'text-base-content/70 hover:text-base-content text-sm';

export function Footer() {
    return (
        <>
            <SilicaFooter className="bg-base-100 border-base-300 gap-x-8 gap-y-10 border-t px-6 pt-16 pb-10 sm:px-8">
                <aside className="flex w-full max-w-[340px] min-w-60 flex-col gap-5">
                    <Wordmark size={48} />
                    <Text className="text-base-content/70 text-sm">
                        Modular content and commerce OS by WizeWorks. Built in Visalia, California. Operating
                        worldwide.
                    </Text>
                    <Badge color="success" variant="soft" className="w-fit gap-1.5">
                        <span className="bg-success h-1.5 w-1.5 rounded-full" />
                        All systems operational
                    </Badge>
                    <Text variant="caption">status.sparx.works</Text>
                </aside>

                {COLUMNS.map((col) => (
                    <nav key={col.title}>
                        <FooterTitle>{col.title}</FooterTitle>
                        {col.links.map((link) => {
                            const external = link.href.startsWith('http');
                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    className={LINK_CLASS}
                                >
                                    {link.label}
                                    {external ? <span className="text-base-content/50 ml-1">↗</span> : null}
                                </Link>
                            );
                        })}
                    </nav>
                ))}
            </SilicaFooter>

            <SilicaFooter className="bg-base-100 px-6 pb-8 sm:px-8">
                <div className="flex w-full flex-col gap-5">
                    <div className="flex flex-col gap-5">
                        <FooterTitle>The sparx domain network</FooterTitle>
                        <div className="flex flex-wrap gap-6">
                            {DOMAINS.map((d) => {
                                const color = d.module ? MODULE_HEX[d.module] : undefined;
                                return (
                                    <span key={d.name} className="flex items-center gap-2">
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${color ? '' : 'bg-base-content/40'}`}
                                            style={color ? { backgroundColor: color } : undefined}
                                        />
                                        <Text
                                            variant="caption"
                                            className={d.primary ? 'text-base-content' : 'text-base-content/70'}
                                        >
                                            {d.name}
                                        </Text>
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                        <Text variant="caption">
                            © 2026 WizeWorks, Inc. · Visalia, California · sparx is a registered trademark of
                            WizeWorks.
                        </Text>
                        <div className="flex items-center gap-4">
                            <Text variant="caption">v1.0 · 2026-05-27</Text>
                            <Text variant="caption" className="text-base-content/70">
                                EN · USD
                            </Text>
                        </div>
                    </div>
                </div>
            </SilicaFooter>
        </>
    );
}
