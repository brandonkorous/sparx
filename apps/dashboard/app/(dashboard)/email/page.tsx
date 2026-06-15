import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Globe,
  Link2,
  Mail,
  MousePointerClick,
  Package,
  PauseCircle,
  Pencil,
  Plus,
  Repeat,
  Send,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  Badge,
  BarList,
  Button,
  Container,
  Grid,
  LineChart,
  PageHeader,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Timeline,
  TimelineItem,
  TimelineTitle,
  TimelineTime,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { SAMPLE_EMAIL_ENGAGEMENT_8W } from '../_components/overview-charts';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
} from '../_components/overview-bits';
import type { OverviewResult } from './_lib/types';

// Email overview — the marketer's morning glance: subscriber pulse, the send
// action queue, deliverability/sender health, and what's converting. The
// engagement KPIs (open/click rate) and deliverability ratios (bounce, spam
// complaints, suppressions) are wired LIVE to /v1/email/analytics/overview
// (fail-soft to "—"); sections without a backing endpoint yet — subscriber
// count, email-attributed revenue, list growth, top links, inbox placement,
// SPF/DKIM/DMARC status, recent broadcasts — render representative data behind
// a <SampleBadge>, the dashboard's sanctioned interim. The email layout already
// wraps this in <ModuleProvider module="email">, so the page never re-wraps.

export const dynamic = 'force-dynamic';

const TWO_COL_FLIP = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// ── Sample data (illustrative until the matching endpoints land) ──
const SAMPLE_BROADCASTS = [
  {
    subject: 'Summer iced drinks are here',
    sent: 'Jun 11',
    recipients: '8,900',
    open: '51.2%',
    click: '6.4%',
    revenue: '$3,210',
    status: 'Sent',
    tone: 'success',
  },
  {
    subject: 'New: Colombia single-origin',
    sent: 'Jun 7',
    recipients: '8,740',
    open: '49.0%',
    click: '5.8%',
    revenue: '$2,480',
    status: 'Sent',
    tone: 'success',
  },
  {
    subject: 'Weekend flash — 15% off beans',
    sent: 'Jun 1',
    recipients: '8,690',
    open: '47.3%',
    click: '6.9%',
    revenue: '$2,910',
    status: 'Sent',
    tone: 'success',
  },
  {
    subject: "Father's Day gifting",
    sent: 'Jun 15',
    recipients: '—',
    open: '—',
    click: '—',
    revenue: '—',
    status: 'Scheduled',
    tone: 'warning',
  },
  {
    subject: 'Back in stock: Switchback Mug',
    sent: '—',
    recipients: '—',
    open: '—',
    click: '—',
    revenue: '—',
    status: 'Draft',
    tone: 'neutral',
  },
] as const;

const BROADCAST_TONE: Record<string, string> = {
  success: 'success',
  warning: 'warning',
  neutral: 'neutral',
};

const SAMPLE_AUTOMATIONS = [
  {
    icon: <Mail className="h-4 w-4" />,
    title: 'Welcome series',
    hint: '412 in flow · 62% open',
    active: true,
  },
  {
    icon: <ShoppingCart className="h-4 w-4" />,
    title: 'Abandoned cart',
    hint: '$2,340 recovered · 30d',
    active: true,
  },
  {
    icon: <Package className="h-4 w-4" />,
    title: 'Post-purchase',
    hint: '311 sent · 54% open',
    active: true,
  },
  {
    icon: <Repeat className="h-4 w-4" />,
    title: 'Win-back',
    hint: 'Paused 6 days ago',
    active: false,
  },
] as const;

const SAMPLE_GROWTH_SOURCES = [
  { label: 'Storefront', value: 52 },
  { label: 'Checkout', value: 28 },
  { label: 'Wholesale', value: 12 },
  { label: 'Import', value: 8 },
] as const;

const SAMPLE_TOP_LINKS = [
  { label: 'Shop beans', value: 38 },
  { label: 'Subscriptions', value: 27 },
  { label: 'Brew guide', value: 21 },
  { label: 'Gift cards', value: 14 },
] as const;

const SAMPLE_INBOX = [
  { provider: 'Gmail', hint: '4,210 delivered', rate: '99.1%' },
  { provider: 'Apple Mail', hint: '2,640 delivered', rate: '98.7%' },
  { provider: 'Outlook', hint: '1,180 delivered', rate: '97.4%' },
  { provider: 'Yahoo', hint: '870 delivered', rate: '96.9%' },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'Broadcast sent — Summer iced drinks (8,900)', when: '3 days ago' },
  { title: "You scheduled Father's Day gifting", when: '1 day ago' },
  { title: 'Automation Abandoned cart → $48 order', when: '5 hours ago' },
  { title: 'Sam Ortiz edited the Welcome series', when: '2 days ago' },
] as const;

// A ratio (n/d) rendered as a whole-percent, fail-soft to "—" on a zero or
// missing denominator so a fresh tenant never sees "NaN%".
function ratePercent(numerator?: number | null, denominator?: number | null, digits = 1): string {
  if (numerator == null || denominator == null || denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

export default async function EmailPage() {
  await requireSession();

  const overview = await api
    .get<OverviewResult>('/v1/email/analytics/overview?days=30')
    .catch(() => null);
  const counts = overview?.counts ?? null;

  // LIVE engagement + deliverability ratios.
  const openRate = ratePercent(counts?.opened, counts?.delivered);
  const clickRate = ratePercent(counts?.clicked, counts?.delivered);
  const bounceRate = ratePercent(counts?.bounced, counts?.accepted);
  const complaintRate = ratePercent(counts?.complained, counts?.accepted, 2);
  const suppressed = overview ? fmtNumber(overview.suppressedTotal) : '—';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Send className="h-5 w-5" />}
          title="Email"
          description="Campaigns & deliverability — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<FileText className="h-4 w-4" />}>
                <Link href="/builder/email">Templates</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/email/broadcasts/new">New broadcast</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — open & click rate live, subscribers & revenue sample */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Subscribers"
            value="9,240"
            hint="+612 this month"
          />
          <Stat
            icon={<Eye className="h-4 w-4" />}
            label="Open rate"
            value={openRate}
            hint={counts ? 'Opened ÷ delivered, last 30d' : 'No sends in the last 30 days'}
          />
          <Stat
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Click rate"
            value={clickRate}
            hint={counts ? 'Clicked ÷ delivered, last 30d' : 'No sends in the last 30 days'}
          />
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Revenue from email · 30d"
            value="$9,310"
            hint="Attributed to email campaigns"
          />
        </Grid>

        {/* Daily action queue */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Send className="h-5 w-5" />}
            count={1}
            label="Broadcast scheduled"
            tone="module"
          >
            <Link href="/email/broadcasts" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Pencil className="h-5 w-5" />}
            count={2}
            label="Drafts waiting"
            tone="module"
          >
            <Link href="/email/broadcasts" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Users className="h-5 w-5" />}
            count={38}
            label="Unengaged to sunset"
            tone="warning"
          >
            <Link href="/email/suppressions" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<PauseCircle className="h-5 w-5" />}
            count={1}
            label="Automation paused"
            tone="danger"
          >
            <Link href="/automations?focus=email" />
          </ActionTile>
        </ActionQueue>

        {/* Sender health + engagement chart — small card on the LEFT */}
        <div className={TWO_COL_FLIP}>
          <OverviewCard
            title="Sender health"
            icon={<ShieldCheck className="h-4 w-4" />}
            right={
              <Badge color="success" variant="soft">
                Healthy
              </Badge>
            }
          >
            <p className="text-[1.65rem] leading-none font-medium">
              98
              <span className="text-base font-normal text-[var(--color-text-tertiary)]">
                {' '}
                / 100
              </span>
            </p>
            <p className="mt-1.5 mb-3 text-sm text-[var(--color-text-tertiary)]">
              Reputation score · sending via{' '}
              <span className="text-[var(--module-active-text)]">sparx.email</span>
            </p>
            <OverviewRow
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="success"
              title="SPF authenticated"
              right={
                <Badge color="success" variant="soft">
                  Pass
                </Badge>
              }
            />
            <OverviewRow
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="success"
              title="DKIM signed"
              right={
                <Badge color="success" variant="soft">
                  Pass
                </Badge>
              }
            />
            <OverviewRow
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="success"
              title="DMARC enforced"
              right={
                <Badge color="success" variant="soft">
                  Pass
                </Badge>
              }
            />
            <OverviewRow
              icon={<TrendingUp className="h-4 w-4" />}
              tone="success"
              title="Bounce rate"
              hint="Well under the 2% threshold"
              right={bounceRate}
            />
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="success"
              title="Spam complaints"
              hint="Under the 0.1% threshold"
              right={complaintRate}
            />
            <OverviewRow
              icon={<Globe className="h-4 w-4" />}
              tone="module"
              title="Suppressed addresses"
              hint="Bounces, complaints & unsubscribes"
              right={suppressed}
            />
          </OverviewCard>

          <OverviewCard
            title="Engagement over time"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Open & click rate · last 8 weeks"
            right={<SampleBadge />}
          >
            <LineChart
              data={SAMPLE_EMAIL_ENGAGEMENT_8W}
              series={[
                { key: 'open', label: 'Open %', color: 'module' },
                { key: 'click', label: 'Click %', color: '#7dd3fc' },
              ]}
              xKey="label"
              height={210}
              valueFormatter={(v) => `${v.toFixed(1)}%`}
              ariaLabel="Open and click rate, last 8 weeks"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Avg. open', '46.7%'],
                ['Avg. click', '5.1%'],
                ['Best send time', 'Tue 9am'],
                ['Unsub rate', '0.18%'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>
        </div>

        {/* Recent broadcasts — the live `recent` feed is per-event rows, not
            broadcast-shaped (no subject/recipients/open/click/revenue), so this
            table renders representative broadcasts behind a SampleBadge. */}
        <OverviewCard
          title="Recent broadcasts"
          icon={<Send className="h-4 w-4" />}
          right={<CardLink href="/email/broadcasts">All broadcasts</CardLink>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Click</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_BROADCASTS.map((b) => (
                <TableRow key={b.subject}>
                  <TableCell className="font-medium">{b.subject}</TableCell>
                  <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                    {b.sent}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.recipients}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.open}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.click}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.revenue}</TableCell>
                  <TableCell>
                    <Badge color={BROADCAST_TONE[b.tone]} variant="soft">
                      {b.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3">
            <SampleBadge />
          </div>
        </OverviewCard>

        {/* Automations + list growth */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Automations"
            icon={<Repeat className="h-4 w-4" />}
            right={<CardLink href="/automations?focus=email">Manage</CardLink>}
          >
            {SAMPLE_AUTOMATIONS.map((a) => (
              <OverviewRow
                key={a.title}
                icon={a.icon}
                tone={a.active ? 'module' : 'danger'}
                title={a.title}
                hint={a.hint}
                right={
                  a.active ? (
                    <Badge color="success" variant="soft">
                      Active
                    </Badge>
                  ) : (
                    <Badge color="danger" variant="soft">
                      Paused
                    </Badge>
                  )
                }
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="List growth"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/crm/customers">Report</CardLink>}
          >
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <MetricTile value="+612" label="New · 30d" tone="success" />
              <MetricTile value="−88" label="Unsubscribed" tone="danger" />
              <MetricTile value="+524" label="Net" tone="module" />
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">Subscribers by source</p>
            <BarList
              items={SAMPLE_GROWTH_SOURCES.map((s) => ({ ...s }))}
              valueFormatter={(v) => `${v}%`}
            />
            <div className="mt-4">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Top links + inbox placement + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Top performing links"
            icon={<Link2 className="h-4 w-4" />}
            right={<CardLink href="/email/broadcasts">Details</CardLink>}
          >
            <BarList
              items={SAMPLE_TOP_LINKS.map((s) => ({ ...s }))}
              valueFormatter={(v) => `${v}%`}
            />
            <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Top click ·{' '}
              <span className="text-[var(--color-text-secondary)]">/shop/all-beans</span> — 1,420
              clicks
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Inbox placement"
            icon={<ShieldCheck className="h-4 w-4" />}
            right={
              <Badge color="success" variant="soft">
                98.0% avg
              </Badge>
            }
          >
            {SAMPLE_INBOX.map((p) => (
              <OverviewRow
                key={p.provider}
                icon={<Mail className="h-4 w-4" />}
                tone="success"
                title={p.provider}
                hint={p.hint}
                right={p.rate}
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />}>
            <Timeline>
              {SAMPLE_ACTIVITY.map((a, i) => (
                <TimelineItem key={a.title} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
                  <TimelineTitle>{a.title}</TimelineTitle>
                  <TimelineTime>{a.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
