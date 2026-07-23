import { Wordmark } from '@sparx/ui';
import { badgeClasses, cx } from '@wizeworks/silicaui-react/server';
import {
  AppWindow,
  Bell,
  Building2,
  ChevronDown,
  FileText,
  Globe,
  LayoutGrid,
  LayoutTemplate,
  type LucideIcon,
  MessageCircle,
  MessageSquarePlus,
  Moon,
  Package,
  PanelLeft,
  Plus,
  Receipt,
  Search,
  Send,
  SendHorizontal,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Users,
  X,
} from 'lucide-react';

// A faithful, LEAN recreation of the real workbench (apps/workbench): the
// top toolbar + thin module rail + a DOCK holding several tiled panes at once
// + the live status bar. It REPLACES the retired single-pane DashboardFrame,
// whose "one sidebar, you always know where you are" argument the MDI workbench
// no longer makes. The point is made by the LAYOUT: three panes from three
// different modules (Commerce · CRM · Email) side by side on one screen, real
// tab strips, a background tab carrying a dirty dot, and a status bar counting
// the unsaved work — "your whole business, open at once," not "click one
// module, see one page."
//
// This is a STATIC Server Component: unlike DashboardFrame there is no radio/
// `:has()` navigation, because the argument here is simultaneity, not
// switching — nothing needs to be clicked to make the point. Appearance is
// class-based (Tailwind utilities reading silica tokens); the only custom
// values are the per-group module hue (`--m`) and its derived tint/ink, set in
// a tiny static <style> block exactly the way the dashboard mock sets `--m` —
// so nothing here stamps a hex or an inline style prop.

const TENANT = 'Lumen & Co.';

// Per-group module hue, plus the shared tint/on-fill-ink derived from it. Static
// (no `:has()`), the sanctioned custom-prop mechanism the sibling mock uses.
const FRAME_CSS = `
.wbx-grp{--m-tint:color-mix(in oklab, var(--m) 13%, var(--color-base-100));--m-ink:var(--color-primary-content);}
.wbx-commerce{--m:var(--color-module-commerce);}
.wbx-crm{--m:var(--color-module-crm);}
.wbx-email{--m:var(--color-module-email);}
`;

// ── Sample data (Lumen & Co., the same tenant the dashboard mock uses) ──

interface Row {
  main: string;
  sub: string;
  status: string;
  num: string;
}

const PRODUCTS: Row[] = [
  { main: 'Trail Tee', sub: '3 variants', status: 'Active', num: '$28' },
  { main: 'Summit Hoodie', sub: 'editing…', status: 'Active', num: '$64' },
  { main: 'Field Cap', sub: 'Northwind', status: 'Draft', num: '$22' },
  { main: 'Canvas Tote', sub: '1 variant', status: 'Active', num: '$18' },
  { main: 'Wool Beanie', sub: 'Northwind', status: 'Low stock', num: '$24' },
];

const ORDERS: Row[] = [
  { main: '#1043', sub: 'Dana Whitfield', status: 'Paid', num: '$92' },
  { main: '#1042', sub: 'Northwind Supply', status: 'Paid', num: '$1,240' },
  { main: '#1041', sub: 'Tom Becker', status: 'Pending', num: '$56' },
  { main: '#1040', sub: 'Priya Anand', status: 'Refunded', num: '$28' },
  { main: '#1039', sub: 'Ridgeline Co.', status: 'Paid', num: '$410' },
];

interface ChatMsg {
  from: 'in' | 'out';
  body: string;
  time: string;
}

const CHAT: ChatMsg[] = [
  { from: 'in', body: 'Hi! Is the Summit Hoodie coming back in large?', time: '10:24' },
  {
    from: 'out',
    body: 'Just restocked it this morning — I’ll set one aside for you.',
    time: '10:26',
  },
  { from: 'in', body: 'Perfect, thank you! Same card as order #1043?', time: '10:27' },
  { from: 'out', body: 'Yes — sending a checkout link now.', time: '10:27' },
];

// Status text → the platform's real statusTone vocabulary → silica badgeClasses,
// so a pill looks exactly like a dashboard <Badge> instead of a mirrored hex.
type Tone = 'success' | 'neutral' | 'warning' | 'danger';
const TONE: Record<string, Tone> = {
  active: 'success',
  paid: 'success',
  draft: 'neutral',
  pending: 'neutral',
  'low stock': 'warning',
  refunded: 'danger',
};
function badgeFor(status: string) {
  return badgeClasses({
    color: TONE[status.toLowerCase()] ?? 'neutral',
    variant: 'soft',
    size: 'sm',
  });
}

const RAIL: { icon: LucideIcon; tone: string; label: string }[] = [
  { icon: LayoutTemplate, tone: 'text-[var(--color-module-builder)]', label: 'Site' },
  { icon: ShoppingCart, tone: 'text-[var(--color-module-commerce)]', label: 'Selling' },
  { icon: FileText, tone: 'text-[var(--color-module-cms)]', label: 'Content' },
  { icon: Users, tone: 'text-[var(--color-module-crm)]', label: 'Customers' },
  { icon: Send, tone: 'text-[var(--color-module-email)]', label: 'Email' },
  { icon: Building2, tone: 'text-[var(--color-module-b2b)]', label: 'B2B' },
];

/**
 * The workbench product-proof frame. Callers wrap it in their own section
 * shell/headline/lede. `bleed` pulls the horizontal scroller out to the page
 * gutter on a phone — correct ONLY when the caller pads by `--gutter-page`
 * (see DashboardFrame's note); a section on Tailwind `px-*` leaves it off.
 */
export function WorkbenchFrame({ bleed = false }: { bleed?: boolean } = {}) {
  return (
    <>
      <span className="mkt-tablet-down-only text-ink-subtle text-mini -mt-10 font-mono">
        Swipe to explore the workbench →
      </span>

      <div
        className={cx(
          'overflow-x-auto [-webkit-overflow-scrolling:touch]',
          bleed && '-mx-page px-page'
        )}
      >
        <div className="bg-base-100 border-base-300 min-w-[1040px] overflow-hidden rounded-xl border">
          <style dangerouslySetInnerHTML={{ __html: FRAME_CSS }} />
          <BrowserChrome />
          <Toolbar />
          <div className="bg-base-200 flex h-[560px] items-stretch">
            <Rail />
            <Dock />
          </div>
          <StatusBar />
        </div>
      </div>
    </>
  );
}

function BrowserChrome() {
  return (
    <div className="bg-base-200 border-base-300 flex items-center gap-3.5 border-b px-5 py-3.5">
      <div className="flex items-center gap-2">
        <span className="bg-error size-[11px] rounded-full" />
        <span className="bg-warning size-[11px] rounded-full" />
        <span className="bg-success size-[11px] rounded-full" />
      </div>
      <div className="bg-base-100 border-base-300 ml-6 flex max-w-[480px] flex-1 items-center gap-2 rounded-md border px-3.5 py-1.5">
        <Shield size={12} strokeWidth={2} className="text-ink-subtle shrink-0" />
        <span className="text-ink-muted text-mini font-mono">app.sparx.works</span>
      </div>
    </div>
  );
}

function Toolbar() {
  return (
    <div className="bg-base-100 border-base-300 flex items-center gap-2 border-b py-2 pr-3 pl-2.5">
      <Wordmark size={22} className="mx-1" />
      <span className="text-small font-medium">{TENANT}</span>
      <span className="text-base-300 select-none">/</span>
      <span className="text-ink-muted text-small inline-flex items-center gap-1.5 rounded-lg px-2 py-1">
        <Globe size={14} strokeWidth={1.8} />
        Main site
        <ChevronDown size={13} strokeWidth={1.8} />
      </span>

      {/* The window search — centered, the workbench's ⌘K front door. */}
      <span className="bg-base-100 border-base-300 text-ink-subtle text-small mx-auto flex w-[280px] max-w-[30%] items-center gap-2 rounded-lg border px-2.5 py-1.5">
        <Search size={14} strokeWidth={1.8} />
        <span className="flex-1 truncate">Search everything</span>
        <span className="bg-base-200 border-base-300 text-ink-subtle text-mini rounded border px-1.5 py-px font-mono">
          ⌘K
        </span>
      </span>

      <div className="flex items-center gap-1">
        <ToolIcon icon={Star} label="Star this screen" />
        <ToolIcon icon={Bell} label="Notifications" />
        <ToolIcon icon={MessageSquarePlus} label="Feedback" />
        <ToolIcon icon={Moon} label="Dark theme" />
        <span className="bg-base-300 text-ink-muted ml-1 inline-flex size-7 items-center justify-center rounded-full text-[11px] font-medium">
          AR
        </span>
      </div>
    </div>
  );
}

function ToolIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      title={label}
      aria-hidden
      className="text-ink-muted inline-flex size-7 items-center justify-center rounded-lg"
    >
      <Icon size={16} strokeWidth={1.8} />
    </span>
  );
}

function Rail() {
  return (
    <aside className="bg-base-200 w-[52px] shrink-0 p-1.5">
      <div className="bg-base-100 flex h-full flex-col items-center gap-1 rounded-lg py-2">
        {RAIL.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.label}
              title={item.label}
              aria-hidden
              className={cx('flex size-[34px] items-center justify-center rounded-lg', item.tone)}
            >
              <Icon size={19} strokeWidth={1.8} />
            </span>
          );
        })}
        <span className="bg-base-300 my-1.5 h-px w-[22px]" />
        <span className="flex-1" />
        <span
          aria-hidden
          title="Workspaces"
          className="text-ink-subtle flex size-[34px] items-center justify-center rounded-lg"
        >
          <LayoutGrid size={19} strokeWidth={1.8} />
        </span>
        <span
          aria-hidden
          title="Collapse"
          className="text-ink-subtle flex size-[34px] items-center justify-center rounded-lg"
        >
          <PanelLeft size={19} strokeWidth={1.8} />
        </span>
      </div>
    </aside>
  );
}

// ── The dock: three tiled groups, three modules, open at once ──

function Dock() {
  return (
    <div className="flex min-w-0 flex-1 gap-1.5 py-1.5 pr-1.5">
      {/* Commerce (orange) — Products, with a dirty background tab. */}
      <Group groupClass="wbx-commerce" grow="flex-[1.5]">
        <TabStrip
          tabs={[
            { icon: Package, label: 'Products', active: true },
            { icon: Tag, label: 'Summit Hoodie', active: false, dirty: true },
          ]}
        />
        <ListPane
          icon={Package}
          title="Products"
          sub="284 in your catalog"
          action="New"
          columns={['Title', 'Status', 'Price']}
          rows={PRODUCTS}
          filter
        />
      </Group>

      {/* CRM (cyan) — Orders. */}
      <Group groupClass="wbx-crm" grow="flex-[1.15]">
        <TabStrip tabs={[{ icon: Receipt, label: 'Orders', active: true }]} />
        <ListPane
          icon={Receipt}
          title="Orders"
          sub="Every channel"
          count="284"
          columns={['Order', 'Status', 'Total']}
          rows={ORDERS}
        />
      </Group>

      {/* Email (sky) — a live customer conversation. */}
      <Group groupClass="wbx-email" grow="flex-[1.25]">
        <TabStrip tabs={[{ icon: MessageCircle, label: 'Inbox — Dana W.', active: true }]} />
        <ChatPane />
      </Group>
    </div>
  );
}

function Group({
  groupClass,
  grow,
  children,
}: {
  groupClass: string;
  grow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        'wbx-grp bg-base-100 border-base-300 flex min-w-0 flex-col overflow-hidden rounded-lg border',
        groupClass,
        grow
      )}
    >
      {children}
    </div>
  );
}

interface Tab {
  icon: LucideIcon;
  label: string;
  active: boolean;
  dirty?: boolean;
}

function TabStrip({ tabs }: { tabs: Tab[] }) {
  return (
    <div className="bg-base-200 border-base-300 flex items-stretch gap-0.5 border-b px-1.5 pt-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <div
            key={tab.label}
            className={cx(
              'flex min-w-0 items-center gap-2 rounded-t-lg border-t-2 border-t-[var(--m)] px-3 py-1.5 text-[13px] whitespace-nowrap',
              tab.active ? 'bg-[var(--m)] text-[var(--m-ink)]' : 'text-ink-muted bg-[var(--m-tint)]'
            )}
          >
            <Icon
              size={14}
              strokeWidth={1.8}
              className={cx('shrink-0', tab.active ? 'text-[var(--m-ink)]' : 'text-[var(--m)]')}
            />
            <span className="min-w-0 truncate">{tab.label}</span>
            {tab.dirty ? (
              <span
                className="bg-warning size-2 shrink-0 rounded-full"
                title="Unsaved changes"
                aria-label="Unsaved changes"
              />
            ) : (
              <span
                className={cx(
                  'inline-flex size-4 items-center justify-center rounded',
                  tab.active ? 'text-[var(--m-ink)]' : 'text-ink-subtle'
                )}
                aria-hidden
              >
                <X size={13} strokeWidth={2} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── List pane (Products / Orders) ──

function ListPane({
  icon: Icon,
  title,
  sub,
  action,
  count,
  columns,
  rows,
  filter = false,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  action?: string;
  count?: string;
  columns: string[];
  rows: Row[];
  filter?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2.5 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[30px] items-center justify-center rounded-lg bg-[var(--m-tint)] text-[var(--m)]">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="text-base-content m-0 text-[16px] font-medium tracking-[-0.01em]">
              {title}
            </h3>
            <p className="text-ink-subtle m-0 mt-px text-[11px]">{sub}</p>
          </div>
        </div>
        {action ? (
          <span className="text-mini inline-flex items-center gap-1 rounded-lg bg-[var(--m)] px-2.5 py-1.5 font-medium whitespace-nowrap text-[var(--m-ink)]">
            <Plus size={13} strokeWidth={2.2} />
            {action}
          </span>
        ) : count ? (
          <span className="text-mini rounded-full bg-[var(--m-tint)] px-2.5 py-0.5 font-medium whitespace-nowrap text-[var(--m)]">
            {count}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-3.5 pt-0.5 pb-2.5">
        <span className="bg-base-100 border-base-300 text-ink-subtle text-mini flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2.5 py-1.5">
          <Search size={13} strokeWidth={1.8} className="shrink-0" />
          Search…
        </span>
        {filter ? (
          <span className="border-base-300 text-ink-muted text-mini inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 whitespace-nowrap">
            Status
            <ChevronDown size={11} className="opacity-60" />
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c}
                  className={cx(
                    'border-base-300 text-ink-subtle text-micro border-b px-3.5 py-2 font-medium tracking-[0.06em] whitespace-nowrap uppercase',
                    i === columns.length - 1 ? 'text-right' : 'text-left'
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const last = ri === rows.length - 1;
              return (
                <tr key={row.main}>
                  <td
                    className={cx(
                      'px-3.5 py-2.5 align-middle',
                      last ? null : 'border-base-300 border-b'
                    )}
                  >
                    <div className="text-base-content font-medium">{row.main}</div>
                    <div className="text-ink-subtle text-mini">{row.sub}</div>
                  </td>
                  <td
                    className={cx(
                      'px-3.5 py-2.5 align-middle',
                      last ? null : 'border-base-300 border-b'
                    )}
                  >
                    <span className={badgeFor(row.status)}>{row.status}</span>
                  </td>
                  <td
                    className={cx(
                      'text-base-content px-3.5 py-2.5 text-right align-middle tabular-nums',
                      last ? null : 'border-base-300 border-b'
                    )}
                  >
                    {row.num}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chat pane (Email / Inbox) ──

function ChatPane() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        <span className="flex size-[30px] items-center justify-center rounded-full bg-[var(--m-tint)] text-[12px] font-medium text-[var(--m)]">
          DW
        </span>
        <div>
          <h3 className="text-base-content m-0 text-[16px] font-medium tracking-[-0.01em]">
            Dana Whitfield
          </h3>
          <p className="text-ink-subtle m-0 mt-px flex items-center gap-1.5 text-[11px]">
            <span className="bg-success inline-block size-1.5 rounded-full" />
            Online now
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3.5 pt-1.5 pb-3">
        <p className="text-ink-subtle text-micro m-0 text-center tracking-[0.04em] uppercase">
          Today
        </p>
        {CHAT.map((msg, i) => (
          <div
            key={i}
            className={cx(
              'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug',
              msg.from === 'in'
                ? 'bg-base-200 text-base-content self-start rounded-bl-sm'
                : 'self-end rounded-br-sm bg-[var(--m)] text-[var(--m-ink)]'
            )}
          >
            {msg.body}
            <span
              className={cx(
                'text-micro mt-1 block',
                msg.from === 'in' ? 'text-ink-subtle' : 'text-right text-[var(--m-ink)]'
              )}
            >
              {msg.time}
            </span>
          </div>
        ))}
      </div>

      <div className="border-base-300 flex items-center gap-2 border-t px-3 py-2.5">
        <span className="bg-base-100 border-base-300 text-ink-subtle flex-1 rounded-full border px-3.5 py-1.5 text-[13px]">
          Message Dana…
        </span>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--m)] text-[var(--m-ink)]">
          <SendHorizontal size={15} strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}

// ── Status bar (live signal strip) ──

function StatusBar() {
  return (
    <div className="bg-base-100 border-base-300 text-ink-muted flex h-8 items-center gap-3.5 border-t px-3.5 text-[13px]">
      <span className="flex items-center gap-1.5">
        <span className="bg-success size-1.5 rounded-full" />
        Saved 2m ago
      </span>
      <span className="flex-1" />
      <span className="text-ink-muted text-mini inline-flex items-center gap-1.5 whitespace-nowrap">
        <ShoppingBag size={13} strokeWidth={1.8} className="text-success" />
        New order — #1043 · 2m ago
      </span>
      <span className="text-ink-muted text-mini inline-flex items-center gap-1.5 whitespace-nowrap">
        <AppWindow size={13} strokeWidth={1.8} />1 window
      </span>
      <span className={badgeClasses({ color: 'warning', variant: 'soft', size: 'sm' })}>
        1 unsaved change
      </span>
    </div>
  );
}
