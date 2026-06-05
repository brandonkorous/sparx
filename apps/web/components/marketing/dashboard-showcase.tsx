import { SparxMark } from '@sparx/ui';
import {
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  Clock,
  Component,
  Database,
  Eye,
  File,
  FileText,
  Filter,
  Fingerprint,
  FolderTree,
  Gauge,
  Globe,
  Home,
  Image as ImageIcon,
  LayoutTemplate,
  type LucideIcon,
  Mail,
  MoreHorizontal,
  Moon,
  Package,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
  Users,
  Workflow,
} from 'lucide-react';
import { Section, SectionHeader } from './primitives';

// Faithful recreation of the real dashboard shell (apps/dashboard): the thin
// gray icon rail + contextual panel + top bar + module overview. Switching
// modules is stateless — eight hidden radios drive everything through CSS
// `:has()` (recolors `--m`, swaps the visible panel/main "tab", moves the rail
// highlight). No `useState`, so this stays a Server Component. Module colors,
// icons (lucide, same as the app), and section names mirror the manifests.

const TENANT = 'Gillett Diesel';

interface ModuleDef {
  key: string;
  label: string;
  color: string;
  tint: string;
  text: string;
  icon: LucideIcon;
  page: { title: string; desc: string; primary: string };
  sections: { label: string; icon: LucideIcon }[];
  stats: { label: string; value: string; delta: string; up: boolean; icon: LucideIcon }[];
  charts: { title: string; sub: string }[];
  cards: { desc: string; name: string }[];
}

const MODULES: ModuleDef[] = [
  {
    key: 'builder',
    label: 'Builder',
    color: '#6366F1',
    tint: '#EEF2FF',
    text: '#4338CA',
    icon: Boxes,
    page: { title: 'Builder', desc: '2 properties · last 14 days', primary: 'New page' },
    sections: [
      { label: 'Overview', icon: Boxes },
      { label: 'Brand', icon: Fingerprint },
      { label: 'Site', icon: Globe },
      { label: 'Page', icon: File },
      { label: 'Email', icon: Mail },
      { label: 'Components', icon: Component },
    ],
    stats: [
      { label: 'Published', value: '24', delta: '+3 this week', up: true, icon: File },
      { label: 'Avg load', value: '<50ms', delta: 'edge cached', up: false, icon: Gauge },
      { label: 'Properties', value: '2', delta: 'one back office', up: false, icon: Boxes },
      { label: 'Uptime', value: '99.9%', delta: 'last 30 days', up: false, icon: BarChart3 },
    ],
    charts: [
      { title: 'Page views', sub: 'Across properties, 14d' },
      { title: 'Publishes', sub: 'Changes shipped, 14d' },
    ],
    cards: [
      { desc: 'Drafts & live, per property', name: 'Pages' },
      { desc: 'Header, footer, layouts', name: 'Site' },
      { desc: 'Logo, colors, type', name: 'Brand' },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    color: '#F97316',
    tint: '#FFF7ED',
    text: '#C2410C',
    icon: ShoppingCart,
    page: { title: 'Commerce', desc: 'Last 30 days', primary: 'New product' },
    sections: [
      { label: 'Overview', icon: ShoppingCart },
      { label: 'Products', icon: Package },
      { label: 'Categories', icon: FolderTree },
      { label: 'Pricing', icon: Tag },
      { label: 'Discounts', icon: Percent },
      { label: 'Inventory', icon: Boxes },
    ],
    stats: [
      { label: 'Net revenue', value: '$48,291', delta: '+8% MoM', up: true, icon: Receipt },
      { label: 'Orders', value: '284', delta: '+12 today', up: true, icon: Package },
      { label: 'Conversion', value: '3.2%', delta: '+0.4 pt', up: true, icon: Percent },
      { label: 'Avg order', value: '$170', delta: '+6%', up: true, icon: Tag },
    ],
    charts: [
      { title: 'Revenue', sub: 'Net revenue, last 14 days' },
      { title: 'Orders', sub: 'Orders placed, last 14 days' },
    ],
    cards: [
      { desc: 'Variants, images, SEO', name: 'Products' },
      { desc: 'Fulfilment & returns', name: 'Orders' },
      { desc: 'Price lists, B2B tiers', name: 'Pricing' },
    ],
  },
  {
    key: 'cms',
    label: 'CMS',
    color: '#14B8A6',
    tint: '#F0FDFA',
    text: '#0F766E',
    icon: FileText,
    page: { title: 'CMS', desc: 'Last 30 days', primary: 'New post' },
    sections: [
      { label: 'Overview', icon: FileText },
      { label: 'Content', icon: FileText },
      { label: 'Content types', icon: Database },
      { label: 'Media', icon: ImageIcon },
      { label: 'Authors', icon: Users },
      { label: 'Taxonomy', icon: Tag },
    ],
    stats: [
      { label: 'Readers', value: '2,480', delta: '+38%', up: true, icon: Eye },
      { label: 'Avg SEO', value: '94', delta: '12 posts', up: false, icon: Gauge },
      { label: 'Subscribers', value: '1,204', delta: '+38 new', up: true, icon: Users },
      { label: 'Posts', value: '86', delta: 'published', up: false, icon: FileText },
    ],
    charts: [
      { title: 'Readers', sub: 'Unique readers, 14d' },
      { title: 'Posts', sub: 'Published, last 14 days' },
    ],
    cards: [
      { desc: 'Posts, pages, entries', name: 'Content' },
      { desc: 'Images & files', name: 'Media' },
      { desc: 'Model your fields', name: 'Content types' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    color: '#06B6D4',
    tint: '#ECFEFF',
    text: '#0E7490',
    icon: Users,
    page: { title: 'CRM', desc: '1,204 customers', primary: 'New customer' },
    sections: [
      { label: 'Overview', icon: Users },
      { label: 'Customers', icon: Users },
      { label: 'B2B accounts', icon: Building2 },
      { label: 'Deals', icon: Briefcase },
      { label: 'Quotes', icon: FileText },
      { label: 'Segments', icon: Filter },
    ],
    stats: [
      { label: 'Customers', value: '1,204', delta: '+46 this week', up: true, icon: Users },
      { label: 'Open deals', value: '12', delta: 'in pipeline', up: false, icon: Briefcase },
      { label: 'Pipeline', value: '$84k', delta: '+11%', up: true, icon: BarChart3 },
      { label: 'Segments', value: '8', delta: 'materialized', up: false, icon: Filter },
    ],
    charts: [
      { title: 'New customers', sub: 'Added, last 14 days' },
      { title: 'Deals', sub: 'Won, last 14 days' },
    ],
    cards: [
      { desc: 'People & companies', name: 'Customers' },
      { desc: 'Pipeline & quotes', name: 'Deals' },
      { desc: 'Materialized lists', name: 'Segments' },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    color: '#0EA5E9',
    tint: '#F0F9FF',
    text: '#0369A1',
    icon: Send,
    page: { title: 'Email', desc: 'Last 30 days', primary: 'New broadcast' },
    sections: [
      { label: 'Overview', icon: Gauge },
      { label: 'Broadcasts', icon: Send },
      { label: 'Automations', icon: Workflow },
      { label: 'Templates', icon: LayoutTemplate },
      { label: 'Sending domains', icon: Globe },
      { label: 'Settings', icon: Settings },
    ],
    stats: [
      { label: 'Sent', value: '18,420', delta: '4 broadcasts', up: false, icon: Send },
      { label: 'Open rate', value: '41%', delta: '+3 pts', up: true, icon: Eye },
      { label: 'Click rate', value: '6.2%', delta: '2.6% avg', up: true, icon: Percent },
      { label: 'Subscribers', value: '9,310', delta: '+1.2k', up: true, icon: Users },
    ],
    charts: [
      { title: 'Opens', sub: 'Across sends, 14d' },
      { title: 'Sends', sub: 'Emails sent, last 14 days' },
    ],
    cards: [
      { desc: 'One-off sends', name: 'Broadcasts' },
      { desc: 'Triggered flows', name: 'Automations' },
      { desc: 'Reusable designs', name: 'Templates' },
    ],
  },
  {
    key: 'b2b',
    label: 'B2B',
    color: '#475569',
    tint: '#F1F5F9',
    text: '#334155',
    icon: Building2,
    page: { title: 'B2B', desc: '37 accounts · Net-30', primary: 'New quote' },
    sections: [
      { label: 'Overview', icon: Building2 },
      { label: 'Accounts', icon: Building2 },
      { label: 'Price lists', icon: Tag },
      { label: 'Quotes', icon: FileText },
      { label: 'Net terms', icon: Receipt },
      { label: 'Approvals', icon: CheckSquare },
    ],
    stats: [
      { label: 'Open quotes', value: '9', delta: '$42k', up: false, icon: Receipt },
      { label: 'Accounts', value: '37', delta: 'on terms', up: false, icon: Building2 },
      { label: 'Avg PO', value: '$576', delta: '+12 items', up: true, icon: Package },
      { label: 'Net terms', value: '$42k', delta: 'outstanding', up: false, icon: Tag },
    ],
    charts: [
      { title: 'Quote value', sub: 'Issued, last 14 days' },
      { title: 'Purchase orders', sub: 'Received, 14d' },
    ],
    cards: [
      { desc: 'Companies & contacts', name: 'Accounts' },
      { desc: 'Per-account pricing', name: 'Price lists' },
      { desc: 'Invoices & approvals', name: 'Net terms' },
    ],
  },
  {
    key: 'dropship',
    label: 'Dropship',
    color: '#10B981',
    tint: '#ECFDF5',
    text: '#047857',
    icon: Truck,
    page: { title: 'Dropship', desc: '6 suppliers · 3 regions', primary: 'Add supplier' },
    sections: [
      { label: 'Overview', icon: Truck },
      { label: 'Suppliers', icon: Truck },
      { label: 'Catalog', icon: Package },
      { label: 'Routing', icon: Filter },
      { label: 'Orders', icon: Receipt },
      { label: 'Sync', icon: RefreshCw },
    ],
    stats: [
      { label: 'Suppliers', value: '6', delta: '3 regions', up: false, icon: Truck },
      { label: 'SKUs synced', value: '12,840', delta: 'hourly', up: false, icon: Package },
      { label: 'Auto-routed', value: '98%', delta: 'of orders', up: true, icon: Percent },
      { label: 'Regions', value: '3', delta: 'fulfilment', up: false, icon: Globe },
    ],
    charts: [
      { title: 'Routed orders', sub: 'Auto-routed, 14d' },
      { title: 'SKU syncs', sub: 'Updates, last 14 days' },
    ],
    cards: [
      { desc: 'Connections & sync', name: 'Suppliers' },
      { desc: 'Imported SKUs', name: 'Catalog' },
      { desc: 'Order assignment', name: 'Routing' },
    ],
  },
  {
    key: 'ai',
    label: 'AI',
    color: '#EC4899',
    tint: '#FDF2F8',
    text: '#9D174D',
    icon: Sparkles,
    page: { title: 'AI', desc: '24 tools · 4 clients', primary: 'New tool' },
    sections: [
      { label: 'Overview', icon: Sparkles },
      { label: 'Assistant', icon: Sparkles },
      { label: 'MCP tools', icon: Component },
      { label: 'Workflows', icon: Workflow },
      { label: 'Knowledge', icon: FileText },
      { label: 'Logs', icon: BarChart3 },
    ],
    stats: [
      { label: 'MCP calls', value: '3,120', delta: 'via MCP', up: false, icon: Sparkles },
      { label: 'Tools live', value: '24', delta: 'all modules', up: false, icon: Component },
      { label: 'Clients', value: '4', delta: 'Claude, GPT…', up: false, icon: Users },
      { label: 'Actions', value: '1,860', delta: '+18%', up: true, icon: BarChart3 },
    ],
    charts: [
      { title: 'MCP calls', sub: 'Tool calls, last 14 days' },
      { title: 'Actions', sub: 'Completed, 14 days' },
    ],
    cards: [
      { desc: 'Ask in plain language', name: 'Assistant' },
      { desc: 'Every module, exposed', name: 'MCP tools' },
      { desc: 'Multi-step actions', name: 'Workflows' },
    ],
  },
];

const DEFAULT_KEY = 'commerce';
const DEFAULT = MODULES.find((m) => m.key === DEFAULT_KEY)!;

// CSS-only interactivity: each radio's `:checked` state recolors `--m` and
// reveals its matching `.dsx-tab` (panel + main share the module class), with
// no client JS. `:has()` is supported in all current browsers; older ones fall
// back to the static default-checked (Commerce) view.
const INTERACTIVE_CSS = `
.dsx-frame{position:relative;--m:${DEFAULT.color};--m-tint:${DEFAULT.tint};--m-text:${DEFAULT.text};}
.dsx-radio{position:absolute;width:1px;height:1px;opacity:0;}
.dsx-tab{display:none;}
.dsx-tab--${DEFAULT_KEY}{display:flex;}
.dsx-railtile{color:var(--color-text-tertiary);cursor:pointer;transition:background .15s ease,color .15s ease;}
.dsx-railtile:hover{background:var(--color-bg-subtle);color:var(--color-text-secondary);}
${MODULES.map(
  (m) => `
.dsx-frame:has(#dsx-${m.key}:checked){--m:${m.color};--m-tint:${m.tint};--m-text:${m.text};}
.dsx-frame:has(#dsx-${m.key}:checked) .dsx-tab{display:none;}
.dsx-frame:has(#dsx-${m.key}:checked) .dsx-tab--${m.key}{display:flex;}
.dsx-frame:has(#dsx-${m.key}:checked) .dsx-railtile--${m.key}{background:var(--m-tint);color:var(--m);}`
).join('')}`;

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function DashboardShowcase() {
  return (
    <Section surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={
            <>
              One pane of glass.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>Every module visible</span>
            </>
          }
          lede={
            <>
              Sparx is one URL, one login, one sidebar. Each active module gets a colored nav item
              and a 3px stripe on its cards — you always know where you are.
            </>
          }
        />

        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            margin: '0 calc(var(--gutter-page) * -1)',
            padding: '0 var(--gutter-page)',
          }}
        >
          <div
            className="dsx-frame"
            style={{
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface)',
              minWidth: '960px',
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: INTERACTIVE_CSS }} />
            {MODULES.map((m) => (
              <input
                key={m.key}
                className="dsx-radio"
                type="radio"
                name="dsx-module"
                id={`dsx-${m.key}`}
                defaultChecked={m.key === DEFAULT_KEY}
                aria-label={m.label}
              />
            ))}

            <BrowserChrome />

            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                minHeight: '560px',
                backgroundColor: 'var(--color-bg-page)',
              }}
            >
              <Rail />
              <Panel />
              <Main />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function BrowserChrome() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 20px',
        backgroundColor: 'var(--color-bg-subtle)',
        borderBottom: '1px solid var(--color-border-default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#FF5F57' }} />
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#FEBC2E' }} />
        <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#28C840' }} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          flex: 1,
          maxWidth: '520px',
          marginLeft: '24px',
        }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 1L3 5V11C3 16 7 21 12 23C17 21 21 16 21 11V5L12 1Z"
            stroke="var(--color-text-secondary)"
            strokeWidth={2}
          />
        </svg>
        <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          app.sparx.works/dashboard
        </span>
      </div>
    </div>
  );
}

// ── Rail (thin gray icon column; module tiles are radio labels) ──

function Rail() {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '56px',
        flexShrink: 0,
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border-default)',
        padding: '12px 0 10px',
        gap: '4px',
      }}
    >
      <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SparxMark size={20} />
      </div>
      <RailStatic icon={Search} label="Search" />
      <RailStatic icon={Home} label="Home" />
      <RailDivider />
      {MODULES.map((m) => {
        const Icon = m.icon;
        return (
          <label
            key={m.key}
            htmlFor={`dsx-${m.key}`}
            className={`dsx-railtile dsx-railtile--${m.key}`}
            title={m.label}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={17} strokeWidth={1.8} />
          </label>
        );
      })}
      <RailDivider />
      <div style={{ flex: 1 }} />
      <RailStatic icon={Gauge} label="SEO" />
      <RailStatic icon={Settings} label="Settings" />
    </aside>
  );
}

function RailStatic({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      title={label}
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-tertiary)',
      }}
    >
      <Icon size={17} strokeWidth={1.8} />
    </span>
  );
}

function RailDivider() {
  return (
    <span
      aria-hidden
      style={{
        width: 26,
        height: 1,
        backgroundColor: 'var(--color-border-default)',
        margin: '5px 0',
      }}
    />
  );
}

// ── Contextual panel (one tab per module; CSS reveals the active one) ──

function Panel() {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '212px',
        flexShrink: 0,
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border-default)',
      }}
    >
      {MODULES.map((m) => (
        <div
          key={m.key}
          className={`dsx-tab dsx-tab--${m.key}`}
          style={{ flexDirection: 'column', minHeight: 0 }}
        >
          <div style={{ padding: '13px 16px 10px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Module
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
              <span
                style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: 'var(--m)' }}
              />
              <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>{m.label}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '2px 8px 12px',
            }}
          >
            {m.sections.map((s, i) => {
              const Icon = s.icon;
              const active = i === 0;
              return (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    height: 32,
                    padding: '0 9px',
                    borderRadius: 7,
                    fontFamily: SANS,
                    fontSize: '13px',
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--m-text)' : 'var(--color-text-secondary)',
                    backgroundColor: active ? 'var(--m-tint)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      color: active ? 'var(--m)' : 'var(--color-text-tertiary)',
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                  </span>
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

// ── Main column (top bar + overview body, one tab per module) ──

function Main() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      {MODULES.map((m) => (
        <div
          key={m.key}
          className={`dsx-tab dsx-tab--${m.key}`}
          style={{ flexDirection: 'column' }}
        >
          <TopBar module={m} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              padding: '8px 24px 26px',
            }}
          >
            <PageHead module={m} />
            <StatRow module={m} />
            <ChartRow module={m} />
            <CardRow module={m} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopBar({ module: m }: { module: ModuleDef }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '11px 22px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontFamily: SANS,
          fontSize: '13px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--color-text-primary)',
          }}
        >
          {TENANT}
          <ChevronDown size={13} style={{ opacity: 0.7 }} />
        </span>
        <span style={{ color: 'var(--color-border-strong)' }}>/</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--m-text)',
          }}
        >
          {m.label}
          <ChevronDown size={13} style={{ opacity: 0.7 }} />
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <Clock size={16} strokeWidth={1.8} />
        <MoreHorizontal size={16} strokeWidth={1.8} />
        <Moon size={16} strokeWidth={1.8} />
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            marginLeft: 4,
            background: 'linear-gradient(135deg, #EEF2FF, #FDF2F8)',
          }}
        />
      </div>
    </div>
  );
}

function PageHead({ module: m }: { module: ModuleDef }) {
  const Icon = m.icon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--m-tint)',
            color: 'var(--m)',
            marginTop: 2,
          }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </span>
        <div>
          <h3
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '24px',
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {m.page.title}
          </h3>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              margin: '3px 0 0',
            }}
          >
            {m.page.desc}
          </p>
        </div>
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '9px 14px',
          borderRadius: 9,
          backgroundColor: 'var(--m)',
          color: '#FFFFFF',
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        <Plus size={14} strokeWidth={2.2} />
        {m.page.primary}
      </span>
    </div>
  );
}

function StatRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
      {m.stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            style={{
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 10,
              padding: '13px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--m-tint)',
                  color: 'var(--m)',
                }}
              >
                <Icon size={13} strokeWidth={1.8} />
              </span>
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '23px',
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: '11.5px',
                marginTop: 3,
                color: s.up ? '#047857' : 'var(--color-text-tertiary)',
              }}
            >
              {s.delta}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <ChartCard title={m.charts[0]!.title} sub={m.charts[0]!.sub}>
        <AreaChart />
      </ChartCard>
      <ChartCard title={m.charts[1]!.title} sub={m.charts[1]!.sub}>
        <BarChart />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 11,
        padding: '14px 16px 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '13.5px',
              color: 'var(--color-text-primary)',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: '11.5px',
              color: 'var(--color-text-tertiary)',
              marginTop: 1,
            }}
          >
            {sub}
          </div>
        </div>
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: 9999,
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            whiteSpace: 'nowrap',
          }}
        >
          Sample data
        </span>
      </div>
      <div style={{ height: 80 }}>{children}</div>
    </div>
  );
}

const AREA_PATH =
  'M0,62 C24,55 38,46 56,49 C80,53 90,66 110,57 C138,45 150,30 176,36 C204,42 214,54 240,33 C270,12 292,22 300,18';
const BARS = [34, 44, 29, 50, 60, 47, 38, 55, 66, 52, 70, 58];

function AreaChart() {
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      style={{ width: '100%', height: 80, display: 'block' }}
    >
      <path d={`${AREA_PATH} L300,80 L0,80 Z`} style={{ fill: 'var(--m)', fillOpacity: 0.12 }} />
      <path
        d={AREA_PATH}
        style={{ fill: 'none', stroke: 'var(--m)', strokeWidth: 2 }}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarChart() {
  const w = 300;
  const h = 80;
  const gap = 7;
  const bw = (w - gap * (BARS.length - 1)) / BARS.length;
  return (
    <svg
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      style={{ width: '100%', height: 80, display: 'block' }}
    >
      {BARS.map((v, i) => {
        const bh = (v / 72) * h;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1.5}
            style={{ fill: 'var(--m)' }}
          />
        );
      })}
    </svg>
  );
}

function CardRow({ module: m }: { module: ModuleDef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
      {m.cards.map((c) => (
        <div
          key={c.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 11,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 3, backgroundColor: 'var(--m)' }} />
          <div
            style={{ display: 'flex', flexDirection: 'column', padding: '13px 15px 14px', flex: 1 }}
          >
            <span
              style={{ fontFamily: SANS, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}
            >
              {c.desc}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '15px',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
                marginTop: 2,
              }}
            >
              {c.name}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 14,
              }}
            >
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  backgroundColor: 'var(--m-tint)',
                  color: 'var(--m-text)',
                }}
              >
                Active
              </span>
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '12px',
                  padding: '5px 12px',
                  borderRadius: 7,
                  backgroundColor: 'var(--m)',
                  color: '#FFFFFF',
                }}
              >
                Open
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
