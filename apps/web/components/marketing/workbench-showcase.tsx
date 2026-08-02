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
// switching — nothing needs to be clicked to make the point.
//
// COLOUR IS THE PLATFORM'S OWN MECHANISM, not a local one. Each group carries
// `data-module="commerce" | "crm" | "email"`, which @sparx/brand/theme.css maps
// to `--color-module` (+ `-content`) for that subtree — the same cascade
// <ModuleScope> uses in the real workbench. Everything below then reads it
// through plugin classes: `bg-module`, `text-module`, `text-module-content`,
// `border-module`, and `bg-module bg-soft` for the tint.
//
// This REPLACED a local `<style>` block that defined its own `--m` / `--m-tint`
// / `--m-ink` triple. Two things were wrong with it, and both are the reason
// DESIGN.md's Contract exists:
//
//   · `--m-tint` hand-rolled `color-mix(in oklab, var(--m) 13%, base)` — which
//     is exactly what silica's `bg-soft` already computes (at 15%), from
//     `--u-accent`, which every `bg-<color>` sets. A private reimplementation of
//     a treatment the design system ships.
//   · `--m-ink` was `var(--color-primary-content)` — i.e. WHITE — used as the
//     ink on ANY module fill. But commerce, cms, crm, email, dropship,
//     inventory, seo and finance all carry DARK `-content` tokens precisely
//     because white fails AA on those hues (theme.css annotates commerce:
//     "white measures 2.80:1 here"). So the local copy reintroduced a contrast
//     bug the token system had already solved. `text-module-content` is correct
//     per hue, automatically.

const TENANT = 'Lumen & Co.';

/** The modules this mock shows, in dock order. Drives `data-module` per group. */
type ShowcaseModule = 'commerce' | 'crm' | 'email';

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
  { icon: LayoutTemplate, tone: 'text-module-builder', label: 'Site' },
  { icon: ShoppingCart, tone: 'text-module-commerce', label: 'Selling' },
  { icon: FileText, tone: 'text-module-cms', label: 'Content' },
  { icon: Users, tone: 'text-module-crm', label: 'Customers' },
  { icon: Send, tone: 'text-module-email', label: 'Email' },
  { icon: Building2, tone: 'text-module-b2b', label: 'B2B' },
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
      <span className="mkt-tablet-down-only -mt-10 font-mono text-sm">
        Swipe to explore the workbench →
      </span>

      <div
        className={cx(
          'overflow-x-auto [-webkit-overflow-scrolling:touch]',
          bleed && '-mx-page px-page'
        )}
      >
        <div className="bg-base-100 text-base-content border-base-300 min-w-[1040px] overflow-hidden rounded-xl border">
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
        <Shield size={12} strokeWidth={2} className="shrink-0" />
        <span className="font-mono text-sm">app.sparx.works</span>
      </div>
    </div>
  );
}

function Toolbar() {
  return (
    <div className="bg-base-100 border-base-300 flex items-center gap-2 border-b py-2 pr-3 pl-2.5">
      <Wordmark size={22} className="mx-1" />
      <span className="text-sm font-medium">{TENANT}</span>
      <span className="text-base-300 select-none">/</span>
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm">
        <Globe size={14} strokeWidth={1.8} />
        Main site
        <ChevronDown size={13} strokeWidth={1.8} />
      </span>

      {/* The window search — centered, the workbench's ⌘K front door. */}
      <span className="bg-base-100 border-base-300 mx-auto flex w-[280px] max-w-[30%] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
        <Search size={14} strokeWidth={1.8} />
        <span className="flex-1 truncate">Search everything</span>
        <span className="bg-base-200 border-base-300 rounded border px-1.5 py-px font-mono text-sm">
          ⌘K
        </span>
      </span>

      <div className="flex items-center gap-1">
        <ToolIcon icon={Star} label="Star this screen" />
        <ToolIcon icon={Bell} label="Notifications" />
        <ToolIcon icon={MessageSquarePlus} label="Feedback" />
        <ToolIcon icon={Moon} label="Dark theme" />
        <span className="bg-base-300 ml-1 inline-flex size-7 items-center justify-center rounded-full text-[11px] font-medium">
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
      className="inline-flex size-7 items-center justify-center rounded-lg"
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
          className="flex size-[34px] items-center justify-center rounded-lg"
        >
          <LayoutGrid size={19} strokeWidth={1.8} />
        </span>
        <span
          aria-hidden
          title="Collapse"
          className="flex size-[34px] items-center justify-center rounded-lg"
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
      <Group module="commerce" grow="flex-[1.5]">
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
      <Group module="crm" grow="flex-[1.15]">
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
      <Group module="email" grow="flex-[1.25]">
        <TabStrip tabs={[{ icon: MessageCircle, label: 'Inbox — Dana W.', active: true }]} />
        <ChatPane />
      </Group>
    </div>
  );
}

/**
 * One tiled group. `data-module` is the load-bearing attribute: theme.css turns
 * it into `--color-module` / `--color-module-content` for this subtree, so every
 * `bg-module` / `text-module` / `text-module-content` below resolves to THIS
 * group's hue with no props threaded through.
 */
function Group({
  module,
  grow,
  children,
}: {
  module: ShowcaseModule;
  grow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-module={module}
      className={cx(
        'bg-base-100 border-base-300 flex min-w-0 flex-col overflow-hidden rounded-lg border',
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
              'border-module flex min-w-0 items-center gap-2 rounded-t-lg border-t-2 px-3 py-1.5 text-[13px] whitespace-nowrap',
              tab.active ? 'bg-module text-module-content' : 'bg-module bg-soft'
            )}
          >
            <Icon
              size={14}
              strokeWidth={1.8}
              className={cx('shrink-0', tab.active ? 'text-module-content' : 'text-module')}
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
                  tab.active ? 'text-module-content' : ''
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
          <span className="bg-module bg-soft text-module flex size-[30px] items-center justify-center rounded-lg">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="m-0 text-[16px] font-medium tracking-[-0.01em]">{title}</h3>
            <p className="m-0 mt-px text-[11px]">{sub}</p>
          </div>
        </div>
        {action ? (
          <span className="bg-module text-module-content inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap">
            <Plus size={13} strokeWidth={2.2} />
            {action}
          </span>
        ) : count ? (
          <span className="bg-module bg-soft text-module rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap">
            {count}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-3.5 pt-0.5 pb-2.5">
        <span className="bg-base-100 border-base-300 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm">
          <Search size={13} strokeWidth={1.8} className="shrink-0" />
          Search…
        </span>
        {filter ? (
          <span className="border-base-300 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm whitespace-nowrap">
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
                    'border-base-300 border-b px-3.5 py-2 text-sm font-medium whitespace-nowrap',
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
                    <div className="font-medium">{row.main}</div>
                    <div className="text-sm">{row.sub}</div>
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
                      'px-3.5 py-2.5 text-right align-middle tabular-nums',
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
        <span className="bg-module bg-soft text-module flex size-[30px] items-center justify-center rounded-full text-[12px] font-medium">
          DW
        </span>
        <div>
          <h3 className="m-0 text-[16px] font-medium tracking-[-0.01em]">Dana Whitfield</h3>
          <p className="m-0 mt-px flex items-center gap-1.5 text-[11px]">
            <span className="bg-success inline-block size-1.5 rounded-full" />
            Online now
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3.5 pt-1.5 pb-3">
        <p className="m-0 text-center text-sm">Today</p>
        {CHAT.map((msg, i) => (
          <div
            key={i}
            className={cx(
              'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug',
              msg.from === 'in'
                ? 'bg-base-200 self-start rounded-bl-sm'
                : 'bg-module text-module-content self-end rounded-br-sm'
            )}
          >
            {msg.body}
            <span
              className={cx(
                'mt-1 block text-sm',
                msg.from === 'in' ? '' : 'text-module-content text-right'
              )}
            >
              {msg.time}
            </span>
          </div>
        ))}
      </div>

      <div className="border-base-300 flex items-center gap-2 border-t px-3 py-2.5">
        <span className="bg-base-100 border-base-300 flex-1 rounded-full border px-3.5 py-1.5 text-[13px]">
          Message Dana…
        </span>
        <span className="bg-module text-module-content inline-flex size-8 shrink-0 items-center justify-center rounded-full">
          <SendHorizontal size={15} strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}

// ── Status bar (live signal strip) ──

function StatusBar() {
  return (
    <div className="bg-base-100 border-base-300 flex h-8 items-center gap-3.5 border-t px-3.5 text-[13px]">
      <span className="flex items-center gap-1.5">
        <span className="bg-success size-1.5 rounded-full" />
        Saved 2m ago
      </span>
      <span className="flex-1" />
      <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
        <ShoppingBag size={13} strokeWidth={1.8} className="text-success" />
        New order — #1043 · 2m ago
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
        <AppWindow size={13} strokeWidth={1.8} />1 window
      </span>
      <span className={badgeClasses({ color: 'warning', variant: 'soft', size: 'sm' })}>
        1 unsaved change
      </span>
    </div>
  );
}
