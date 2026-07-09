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
  Pencil,
  Plus,
  Repeat,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  PageHeader,
  Stat,
  Timeline,
  TimelineItem,
  TimelineTitle,
  TimelineTime,
} from '@sparx/ui';
import { Badge, Button, EmptyState, Table } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtNumber,
} from '../_components/overview-bits';
import type { OverviewResult } from './_lib/types';

// Email overview — the marketer's morning glance: subscriber pulse, the send
// action queue, deliverability/sender health, and what's converting. Every
// section is wired to the live /v1/email/* endpoints; a section with no data
// yet (or no backing endpoint) renders a compact empty state rather than
// illustrative sample data. The email layout already wraps this in
// <ModuleProvider module="email">, so the page never re-wraps — there is one
// page-level module scope, and exactly one card in it stays tinted (Recent
// broadcasts, the headline list); every other card passes `plain`.

export const dynamic = 'force-dynamic';

const TWO_COL_FLIP = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// ── Live shapes + display rows ───────────────────────────────
interface BroadcastRow {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  scheduledAt: string | null;
  recipientCount: number;
}
interface BroadcastStats {
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}
interface DomainRow {
  id: string;
  domain: string;
  state: string;
  isDefault: boolean;
}

// Display rows for the broadcast table and the sender-health domain list.
interface BroadcastDisplay {
  subject: string;
  sentLabel: string;
  recipients: string;
  openRate: string;
  clickRate: string;
  statusLabel: string;
  tone: string;
}
interface VerifyRow {
  title: string;
  statusLabel: string;
  tone: string;
}

const BROADCAST_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'warning' },
  sending: { label: 'Sending', tone: 'warning' },
  sent: { label: 'Sent', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
};
const DOMAIN_STATE: Record<string, { label: string; tone: string }> = {
  verified: { label: 'Verified', tone: 'success' },
  verifying: { label: 'Verifying', tone: 'warning' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  disabled: { label: 'Disabled', tone: 'danger' },
};

// Short, locale-stable date for the broadcast table (e.g. "Jun 11").
function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

// A ratio (n/d) rendered as a whole-percent, fail-soft to "—" on a zero or
// missing denominator so a fresh tenant never sees "NaN%".
function ratePercent(numerator?: number | null, denominator?: number | null, digits = 1): string {
  if (numerator == null || denominator == null || denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

// Relative "time ago" for the activity timeline (request-time, so dynamic).
function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Human label for a recent-engagement event type (open/click/bounce/…).
const RECENT_EVENT_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  bounced: 'Bounced',
  complained: 'Complaint',
  unsubscribed: 'Unsubscribed',
  failed: 'Failed',
};

interface SubscriberGrowthPoint {
  bucket: string;
  added: number;
  removed: number;
  net: number;
}
interface SubscriberGrowth {
  range: { from: string; to: string; grain: string };
  points: SubscriberGrowthPoint[];
  totals: { added: number; removed: number; net: number };
  currentSubscribers: number;
}

export default async function EmailPage() {
  await requireSession();

  const [overview, subGrowth] = await Promise.all([
    api.get<OverviewResult>('/v1/email/analytics/overview?days=30').catch(() => null),
    api.get<SubscriberGrowth>('/v1/email/analytics/subscriber-growth?grain=day').catch(() => null),
  ]);
  const counts = overview?.counts ?? null;

  // LIVE engagement + deliverability ratios.
  const openRate = ratePercent(counts?.opened, counts?.delivered);
  const clickRate = ratePercent(counts?.clicked, counts?.delivered);
  const bounceRate = ratePercent(counts?.bounced, counts?.accepted);
  const complaintRate = ratePercent(counts?.complained, counts?.accepted, 2);
  const suppressed = overview ? fmtNumber(overview.suppressedTotal) : '—';

  // Recent broadcasts (+ per-send stats) and sending-domain verification — live.
  const broadcastsPage = await api
    .getPaged<BroadcastRow[]>('/v1/email/broadcasts?take=6')
    .catch(() => null);
  const [withStats, liveDomainsPage] = await Promise.all([
    broadcastsPage
      ? Promise.all(
          broadcastsPage.data.map(async (b) => ({
            b,
            stats:
              b.status === 'sent'
                ? await api
                    .get<BroadcastStats>(`/v1/email/broadcasts/${b.id}/stats`)
                    .catch(() => null)
                : null,
          }))
        )
      : Promise.resolve(null),
    api.getPaged<DomainRow[]>('/v1/email/domains?take=10').catch(() => null),
  ]);
  const liveDomains = liveDomainsPage?.data ?? null;
  const allBroadcasts = broadcastsPage?.data ?? [];

  const broadcastRows: BroadcastDisplay[] = (withStats ?? []).map(({ b, stats }) => {
    const meta = BROADCAST_STATUS[b.status] ?? { label: b.status, tone: 'neutral' };
    const dateIso = b.sentAt ?? b.scheduledAt;
    return {
      subject: b.subject || b.name,
      sentLabel: dateIso ? fmtShortDate(dateIso) : '—',
      recipients: b.status === 'draft' ? '—' : fmtNumber(b.recipientCount),
      openRate: stats ? ratePercent(stats.opened, stats.delivered) : '—',
      clickRate: stats ? ratePercent(stats.clicked, stats.delivered) : '—',
      statusLabel: meta.label,
      tone: meta.tone,
    };
  });

  const authRows: VerifyRow[] = (liveDomains ?? []).map((d) => {
    const meta = DOMAIN_STATE[d.state] ?? { label: d.state, tone: 'neutral' };
    return {
      title: d.isDefault ? `${d.domain} · default` : d.domain,
      statusLabel: meta.label,
      tone: meta.tone,
    };
  });
  const domainHealth = liveDomains?.length
    ? liveDomains.every((d) => d.state === 'verified')
      ? { label: 'Verified', tone: 'success' as const }
      : { label: 'Action needed', tone: 'warning' as const }
    : null;

  // ActionQueue counts — derived from the broadcast list already fetched.
  const scheduledCount = allBroadcasts.filter((b) => b.status === 'scheduled').length;
  const draftCount = allBroadcasts.filter((b) => b.status === 'draft').length;
  const hasActionTiles = scheduledCount > 0 || draftCount > 0;

  // Recent activity — live engagement events from the overview report.
  const activityRows = (overview?.recent ?? []).map((e) => ({
    title: `${RECENT_EVENT_LABEL[e.type] ?? e.type} — ${e.recipient}`,
    when: relTime(e.occurredAt),
  }));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Send className="h-5 w-5" />}
          title="Email"
          description="Campaigns & deliverability — last 30 days."
          actions={
            <>
              <Button
                render={<Link href="/builder/email" />}
                variant="outline"
                iconStart={<FileText className="h-4 w-4" />}
              >
                Templates
              </Button>
              <Button
                render={<Link href="/email/broadcasts/new" />}
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
              >
                New broadcast
              </Button>
            </>
          }
        />

        {/* Headline KPIs — subscribers, open & click rate live; revenue from
            email has no attribution endpoint yet, so it shows "—". */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Subscribers"
            value={subGrowth ? fmtNumber(subGrowth.currentSubscribers) : '—'}
            hint={
              subGrowth
                ? `${subGrowth.totals.net >= 0 ? '+' : ''}${fmtNumber(subGrowth.totals.net)} net · last 30d`
                : 'Mailable contacts'
            }
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
            value="—"
            hint="Attributed to email campaigns"
          />
        </div>

        {/* Daily action queue — wired to broadcast statuses; only rendered when
            something actually needs attention. */}
        {hasActionTiles && (
          <ActionQueue title="Needs attention" icon={<AlertTriangle className="h-4 w-4" />}>
            {scheduledCount > 0 && (
              <ActionTile
                asChild
                icon={<Send className="h-5 w-5" />}
                count={scheduledCount}
                label={scheduledCount === 1 ? 'Broadcast scheduled' : 'Broadcasts scheduled'}
                tone="module"
              >
                <Link href="/email/broadcasts" />
              </ActionTile>
            )}
            {draftCount > 0 && (
              <ActionTile
                asChild
                icon={<Pencil className="h-5 w-5" />}
                count={draftCount}
                label={draftCount === 1 ? 'Draft waiting' : 'Drafts waiting'}
                tone="module"
              >
                <Link href="/email/broadcasts" />
              </ActionTile>
            )}
          </ActionQueue>
        )}

        {/* Sender health + engagement — both neutral (plain); the page's one
            tinted card is Recent broadcasts below. */}
        <div className={TWO_COL_FLIP}>
          <OverviewCard
            title="Sender health"
            icon={<ShieldCheck className="h-4 w-4" />}
            right={
              domainHealth ? (
                <Badge color={domainHealth.tone} variant="soft">
                  {domainHealth.label}
                </Badge>
              ) : undefined
            }
            plain
          >
            <p className="text-base-content/50 mb-3 text-sm">
              Authentication &amp; deliverability · sending via{' '}
              <span className="text-module">sparx.email</span>
            </p>
            {authRows.length ? (
              authRows.map((r) => (
                <OverviewRow
                  key={r.title}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  tone={r.tone}
                  title={r.title}
                  right={
                    <Badge color={r.tone} variant="soft">
                      {r.statusLabel}
                    </Badge>
                  }
                />
              ))
            ) : (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No sending domain yet"
                description="Verify a domain to authenticate your email and protect deliverability."
                actions={
                  <Button variant="outline" size="sm" render={<Link href="/email/domains" />}>
                    Add domain
                  </Button>
                }
              />
            )}
            <OverviewRow
              icon={<TrendingUp className="h-4 w-4" />}
              tone={counts ? 'success' : 'module'}
              title="Bounce rate"
              hint="Keep under the 2% threshold"
              right={bounceRate}
            />
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={counts ? 'success' : 'module'}
              title="Spam complaints"
              hint="Keep under the 0.1% threshold"
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
            description="Open & click rate"
            plain
          >
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No engagement trend yet"
              description="Open and click rates chart here once your broadcasts collect activity."
            />
          </OverviewCard>
        </div>

        {/* Recent broadcasts — the page's one tinted card; live list + per-send
            open/click stats. */}
        <OverviewCard
          title="Recent broadcasts"
          icon={<Send className="h-4 w-4" />}
          right={<CardLink href="/email/broadcasts">All broadcasts</CardLink>}
        >
          {broadcastRows.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Recipients</th>
                  <th className="text-right">Open</th>
                  <th className="text-right">Click</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {broadcastRows.map((b, i) => (
                  <tr key={`${b.subject}-${i}`}>
                    <td className="font-medium">{b.subject}</td>
                    <td className="text-base-content/50 text-right tabular-nums">{b.sentLabel}</td>
                    <td className="text-right tabular-nums">{b.recipients}</td>
                    <td className="text-right tabular-nums">{b.openRate}</td>
                    <td className="text-right tabular-nums">{b.clickRate}</td>
                    <td>
                      <Badge color={b.tone} variant="soft">
                        {b.statusLabel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<Send className="h-5 w-5" />}
              title="No broadcasts yet"
              description="Send your first campaign and per-send open & click rates land here."
              actions={
                <Button variant="outline" size="sm" render={<Link href="/email/broadcasts/new" />}>
                  New broadcast
                </Button>
              }
            />
          )}
        </OverviewCard>

        {/* Automations + list growth */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Automations"
            icon={<Repeat className="h-4 w-4" />}
            right={<CardLink href="/automations?focus=email">Manage</CardLink>}
            plain
          >
            <EmptyState
              icon={<Repeat className="h-5 w-5" />}
              title="No automations yet"
              description="Welcome series, abandoned cart, and win-back flows show their health here."
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/automations?focus=email" />}
                >
                  Create automation
                </Button>
              }
            />
          </OverviewCard>

          <OverviewCard
            title="List growth"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Contacts added vs. unsubscribed · last 30 days"
            right={subGrowth ? <CardLink href="/crm/customers">Contacts</CardLink> : undefined}
            plain
          >
            {subGrowth ? (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                  <MetricTile
                    value={`+${fmtNumber(subGrowth.totals.added)}`}
                    label="New · 30d"
                    tone="success"
                  />
                  <MetricTile
                    value={`−${fmtNumber(subGrowth.totals.removed)}`}
                    label="Unsubscribed"
                    tone="danger"
                  />
                  <MetricTile
                    value={`${subGrowth.totals.net >= 0 ? '+' : ''}${fmtNumber(subGrowth.totals.net)}`}
                    label="Net"
                    tone="module"
                  />
                </div>
                <div className="border-base-300 flex items-baseline justify-between border-t pt-3 text-sm">
                  <span className="text-base-content/50">Current list size</span>
                  <span className="font-medium">{fmtNumber(subGrowth.currentSubscribers)}</span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No list growth yet"
                description="Contacts added and unsubscribed appear here as your list moves."
              />
            )}
          </OverviewCard>
        </div>

        {/* Top links + suppressions + recent activity */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OverviewCard
            title="Top performing links"
            icon={<Link2 className="h-4 w-4" />}
            right={<CardLink href="/email/broadcasts">Details</CardLink>}
            plain
          >
            <EmptyState
              icon={<Link2 className="h-5 w-5" />}
              title="No link clicks yet"
              description="The links your subscribers click most rank here after a send."
            />
          </OverviewCard>

          <OverviewCard
            title="Suppressions"
            icon={<ShieldCheck className="h-4 w-4" />}
            right={
              overview ? (
                <Badge color={overview.suppressedTotal > 0 ? 'warning' : 'success'} variant="soft">
                  {suppressed}
                </Badge>
              ) : undefined
            }
            plain
          >
            {overview && overview.suppressedTotal > 0 ? (
              <>
                <OverviewRow
                  icon={<Mail className="h-4 w-4" />}
                  tone="warning"
                  title="Suppressed addresses"
                  hint="Bounces, complaints & unsubscribes — excluded from sends"
                  right={suppressed}
                />
                <div className="mt-3">
                  <CardLink href="/email/suppressions">Manage suppressions</CardLink>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No suppressions"
                description="Bounced, complained, and unsubscribed addresses collect here."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            {activityRows.length ? (
              <Timeline>
                {activityRows.map((a, i) => (
                  <TimelineItem key={`${a.title}-${i}`} showConnector={i < activityRows.length - 1}>
                    <TimelineTitle>{a.title}</TimelineTitle>
                    <TimelineTime>{a.when}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No recent activity"
                description="Opens, clicks, and sends show up here as they happen."
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
