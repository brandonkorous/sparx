import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  Clock,
  Inbox,
  MessagesSquare,
  Settings,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  Badge,
  BarList,
  Button,
  Container,
  DonutChart,
  Grid,
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
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
  fmtPercentRatio,
  liveOr,
} from '../_components/overview-bits';
import type { ConversationStatus, ConversationSummaryDto } from './_lib/types';

// Live Chat overview — "Are conversations handled fast and well?". The
// conversation pulse, the volume timeseries, the AI-vs-human resolution split,
// channel mix, agent performance, and the activity feed are all LIVE: the
// recent-conversations table + counts from /v1/chat/conversations, and the
// reporting figures from /v1/chat/analytics/* (summary, timeseries, agents,
// activity). Each falls back to a badged sample until the tenant has chat
// history. CSAT alone stays sample — there's no rating-capture model yet
// (workload B, docs/97 §4). The /chat layout wraps this in
// <ModuleProvider module="chat"> + the module gate, so the page never re-wraps.
// The working inbox lives at /chat/inbox.

export const dynamic = 'force-dynamic';

const TWO_COL_FLIP = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';

const STATUS_META: Record<ConversationStatus, { color: string; label: string }> = {
  open: { color: 'module', label: 'Open' },
  pending: { color: 'warning', label: 'Waiting' },
  resolved: { color: 'success', label: 'Resolved' },
  spam: { color: 'neutral', label: 'Spam' },
};

// ── Live analytics shapes (/v1/chat/analytics/*) ──
interface ChatSummary {
  startedInRange: number;
  resolvedInRange: number;
  openNow: number;
  avgFirstResponseSeconds: number | null;
  aiResolved: number;
  humanResolved: number;
  aiHandledPct: number | null;
  byChannel: { source: string; count: number }[];
}

interface ChatTimeseries {
  points: { bucket: string; started: number; resolved: number }[];
  totals: { started: number; resolved: number };
}

interface ChatAgentRow {
  kind: 'staff' | 'ai';
  id: string | null;
  name: string;
  handled: number;
  avgResponseSeconds: number | null;
}

interface ChatActivityItem {
  id: string;
  conversationId: string;
  senderType: string;
  aiGenerated: boolean;
  who: string;
  snippet: string;
  createdAt: string;
}

// The normalized rows the cards render — shared by live + sample so liveOr can
// fall back cleanly.
interface ChannelRow {
  label: string;
  value: number;
}
interface AgentDisplayRow {
  key: string;
  isAi: boolean;
  name: string;
  hint: string;
}
interface ActivityEntry {
  key: string;
  title: string;
  when: string;
}

// Real conversation sources → friendly channel labels.
const CHANNEL_LABEL: Record<string, string> = {
  site: 'Website',
  sparx_market: 'sparx Market',
  dashboard: 'Dashboard',
};

// Seconds → "Xm Ys" / "Ys" for response/handle latencies.
function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// Compact relative time for the activity feed (server-rendered).
function timeAgo(iso: string, nowMs: number): string {
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// A chat message → the activity verb shown in the timeline.
function activityVerb(senderType: string, aiGenerated: boolean): string {
  if (senderType === 'ai' || aiGenerated) return 'AI replied to';
  if (senderType === 'staff') return 'Staff replied to';
  return 'New message from';
}

// ── Sample data (illustrative until chat reporting endpoints land) ──
const SAMPLE_CONVOS_14D = [
  { label: 'May 31', started: 118, resolved: 110 },
  { label: 'Jun 1', started: 104, resolved: 101 },
  { label: 'Jun 2', started: 132, resolved: 124 },
  { label: 'Jun 3', started: 126, resolved: 122 },
  { label: 'Jun 4', started: 112, resolved: 108 },
  { label: 'Jun 5', started: 144, resolved: 138 },
  { label: 'Jun 6', started: 138, resolved: 132 },
  { label: 'Jun 7', started: 158, resolved: 150 },
  { label: 'Jun 8', started: 150, resolved: 146 },
  { label: 'Jun 9', started: 172, resolved: 165 },
  { label: 'Jun 10', started: 164, resolved: 159 },
  { label: 'Jun 11', started: 186, resolved: 178 },
  { label: 'Jun 12', started: 178, resolved: 174 },
  { label: 'Jun 13', started: 196, resolved: 188 },
] as const;

const SAMPLE_CHANNELS: ChannelRow[] = [
  { label: 'Website', value: 58 },
  { label: 'Email', value: 22 },
  { label: 'Instagram', value: 12 },
  { label: 'Facebook', value: 8 },
];

const SAMPLE_AGENTS: AgentDisplayRow[] = [
  { key: 'a1', isAi: false, name: 'Sam Ortiz', hint: '142 handled · 1m 20s avg' },
  { key: 'a2', isAi: false, name: 'You', hint: '88 handled · 2m 05s avg' },
  { key: 'a3', isAi: true, name: 'AI assistant', hint: '1,180 handled · instant' },
];

const SAMPLE_ACTIVITY: ActivityEntry[] = [
  { key: 'e1', title: 'AI replied to Maya Chen', when: 'just now' },
  { key: 'e2', title: 'Staff replied to Theo Marsh', when: '4m ago' },
  { key: 'e3', title: 'New message from Devon Walls', when: '12m ago' },
  { key: 'e4', title: 'AI replied to Priya Nair', when: '28m ago' },
];

function waitLabel(c: ConversationSummaryDto): string {
  if (c.status === 'resolved' || c.status === 'spam' || !c.lastMessageAt) return '—';
  const secs = Math.max(0, Math.round((Date.now() - new Date(c.lastMessageAt).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export default async function ChatPage() {
  await requireSession();

  const nowMs = Date.now();

  const [convos, summary, timeseries, agents, activity] = await Promise.all([
    api
      .getPaged<ConversationSummaryDto[]>('/v1/chat/conversations?take=50')
      .then((r) => r.data ?? [])
      .catch(() => [] as ConversationSummaryDto[]),
    api.get<ChatSummary>('/v1/chat/analytics/summary').catch(() => null),
    api.get<ChatTimeseries>('/v1/chat/analytics/timeseries?grain=day').catch(() => null),
    api.get<ChatAgentRow[]>('/v1/chat/analytics/agents').catch(() => null),
    api.get<ChatActivityItem[]>('/v1/chat/analytics/activity?limit=8').catch(() => null),
  ]);

  const isOpen = (c: ConversationSummaryDto) => c.status === 'open' || c.status === 'pending';
  const openCount = convos.filter(isOpen).length;
  const activeCount = convos.filter((c) => c.status === 'open').length;
  const unassigned = convos.filter((c) => isOpen(c) && !c.assignedToId).length;
  const recent = [...convos]
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
    .slice(0, 6);

  // KPI values — live from the summary, else the representative sample figure.
  const avgFirstResponse =
    summary?.avgFirstResponseSeconds != null
      ? fmtDuration(summary.avgFirstResponseSeconds)
      : '1m 48s';
  const aiHandled =
    summary?.aiHandledPct != null ? fmtPercentRatio(summary.aiHandledPct, 0) : '64%';

  // AI-vs-human resolution split — live once any conversation has resolved.
  const resolvedClassified = (summary?.aiResolved ?? 0) + (summary?.humanResolved ?? 0);
  const resolutionLive = summary != null && resolvedClassified > 0;
  const aiShare = resolutionLive
    ? Math.round(((summary?.aiResolved ?? 0) / resolvedClassified) * 100)
    : 64;
  const donutData = resolutionLive
    ? [
        { label: 'AI-resolved', value: summary?.aiResolved ?? 0, color: 'module' },
        { label: 'Human', value: summary?.humanResolved ?? 0, color: 'var(--module-active-tint)' },
      ]
    : [
        { label: 'AI-resolved', value: 64, color: 'module' },
        { label: 'Human', value: 36, color: 'var(--module-active-tint)' },
      ];

  // Conversations-over-time area — live once the window has any started convo.
  const tsPoints =
    timeseries && timeseries.totals.started > 0
      ? timeseries.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          started: p.started,
          resolved: p.resolved,
        }))
      : null;
  const convos14d = liveOr(tsPoints, [...SAMPLE_CONVOS_14D]);

  // By channel — live source mix, else the representative sample.
  const channelRows: ChannelRow[] | null =
    summary && summary.byChannel.length > 0
      ? summary.byChannel.map((c) => ({
          label: CHANNEL_LABEL[c.source] ?? c.source,
          value: c.count,
        }))
      : null;
  const channels = liveOr<ChannelRow[]>(channelRows, SAMPLE_CHANNELS);

  // Agent performance — first-responder rollup, else sample.
  const agentRows: AgentDisplayRow[] | null =
    agents && agents.length > 0
      ? agents.map((a) => ({
          key: a.id ?? a.kind,
          isAi: a.kind === 'ai',
          name: a.name,
          hint: `${fmtNumber(a.handled)} handled${
            a.avgResponseSeconds != null ? ` · ${fmtDuration(a.avgResponseSeconds)} avg` : ''
          }`,
        }))
      : null;
  const agentList = liveOr<AgentDisplayRow[]>(agentRows, SAMPLE_AGENTS);

  // Recent activity — live message feed, else sample.
  const activityRows: ActivityEntry[] | null =
    activity && activity.length > 0
      ? activity.map((a) => ({
          key: a.id,
          title: `${activityVerb(a.senderType, a.aiGenerated)} ${a.who}`,
          when: timeAgo(a.createdAt, nowMs),
        }))
      : null;
  const activityFeed = liveOr<ActivityEntry[]>(activityRows, SAMPLE_ACTIVITY);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<MessagesSquare className="h-5 w-5" />}
          title="Live Chat"
          description="Conversations & inbox — across every channel."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Settings className="h-4 w-4" />}>
                <Link href="/settings/chat">Settings</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<Zap className="h-4 w-4" />}>
                <Link href="/settings/chat">Quick replies</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Inbox className="h-4 w-4" />}>
                <Link href="/chat/inbox">Open inbox</Link>
              </Button>
            </>
          }
        />

        {/* KPI strip — conversation counts live, quality metrics sample */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<MessagesSquare className="h-4 w-4" />}
            label="Open conversations"
            value={fmtNumber(openCount)}
            hint={`${fmtNumber(unassigned)} unassigned · ${fmtNumber(activeCount)} active`}
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Avg. first response"
            value={avgFirstResponse}
            hint="First staff/AI reply · 30d"
          />
          <Stat
            icon={<Bot className="h-4 w-4" />}
            label="AI-handled"
            value={aiHandled}
            hint="Of resolved conversations"
          />
          <Stat
            icon={<Star className="h-4 w-4" />}
            label="CSAT"
            value="4.6 / 5"
            hint="212 ratings"
          />
        </Grid>

        {/* Needs attention — unassigned live, rest sample */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<MessagesSquare className="h-5 w-5" />}
            count={unassigned}
            label="Unassigned"
            tone="module"
          >
            <Link href="/chat/inbox" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Clock className="h-5 w-5" />}
            count={3}
            label="Waiting on you"
            tone="danger"
          >
            <Link href="/chat/inbox" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Bot className="h-5 w-5" />}
            count={2}
            label="AI-escalated"
            tone="warning"
          >
            <Link href="/chat/inbox" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={4}
            label="Follow-ups due"
            tone="warning"
          >
            <Link href="/chat/inbox" />
          </ActionTile>
        </ActionQueue>

        {/* Resolution (signature): AI vs human + conversations over time */}
        <div className={TWO_COL_FLIP}>
          <OverviewCard
            title="AI vs human"
            icon={<Bot className="h-4 w-4" />}
            right={resolutionLive ? undefined : <SampleBadge reason="no-data" />}
          >
            <DonutChart
              data={donutData}
              valueFormat={resolutionLive ? 'number' : 'percent'}
              centerValue={`${aiShare}%`}
              centerLabel="AI-resolved"
              ariaLabel="AI vs human resolution"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile
                value={resolutionLive ? fmtNumber(summary?.resolvedInRange ?? 0) : '1,790'}
                label="Resolved · 30d"
              />
              <MetricTile value={avgFirstResponse} label="Avg. response" />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Conversations over time"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Started & resolved · last 14 days"
            right={convos14d.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={convos14d.data}
              series={[
                { key: 'started', label: 'Started', color: 'module' },
                { key: 'resolved', label: 'Resolved', color: 'var(--module-active-tint)' },
              ]}
              xKey="label"
              height={210}
              valueFormat="number"
              ariaLabel="Conversations started and resolved, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {(
                [
                  ['Started', fmtNumber(timeseries?.totals.started ?? 1840)],
                  ['Resolved', fmtNumber(timeseries?.totals.resolved ?? 1790)],
                  ['Avg. response', avgFirstResponse],
                  ['AI-handled', aiHandled],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>
        </div>

        {/* Recent conversations — live */}
        <OverviewCard
          title="Recent conversations"
          icon={<MessagesSquare className="h-4 w-4" />}
          right={<CardLink href="/chat/inbox">Open inbox</CardLink>}
        >
          {recent.length === 0 ? (
            <p className="py-6 text-sm text-[var(--color-text-tertiary)]">
              No conversations yet — they’ll appear here as customers reach out.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Last message</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Wait</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((c) => {
                  const meta = STATUS_META[c.status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/chat/inbox/${c.id}`}
                          className="text-[var(--color-text-primary)] hover:text-[var(--module-active-text)]"
                        >
                          {c.customerName ?? c.customerEmail ?? 'Anonymous visitor'}
                        </Link>
                        {c.unreadStaff > 0 && (
                          <Badge color="danger" variant="solid" size="sm" className="ml-2">
                            {c.unreadStaff}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[22rem] truncate text-[var(--color-text-secondary)]">
                        {c.lastMessageSnippet ?? 'No messages yet'}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-tertiary)] capitalize">
                        {c.source}
                      </TableCell>
                      <TableCell>
                        <Badge color={meta.color} variant="soft">
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                        {waitLabel(c)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </OverviewCard>

        {/* By channel + agent performance + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="By channel"
            icon={<TrendingUp className="h-4 w-4" />}
            right={channels.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <BarList
              items={channels.data.map((c) => ({ ...c }))}
              color="module"
              valueFormat={channels.isSample ? 'percent' : 'number'}
            />
            <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Top source ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                {channels.data[0]?.label ?? '—'}
              </span>{' '}
              — {fmtNumber(channels.data[0]?.value ?? 0)}
              {channels.isSample ? '%' : ' chats'}
            </p>
          </OverviewCard>

          <OverviewCard
            title="Agent performance"
            icon={<Users className="h-4 w-4" />}
            right={agentList.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            {agentList.data.map((a) => (
              <OverviewRow
                key={a.key}
                icon={a.isAi ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                tone="module"
                title={a.name}
                hint={a.hint}
              />
            ))}
          </OverviewCard>

          <OverviewCard
            title="Recent activity"
            icon={<Clock className="h-4 w-4" />}
            right={activityFeed.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <Timeline>
              {activityFeed.data.map((a, i) => (
                <TimelineItem key={a.key} showConnector={i < activityFeed.data.length - 1}>
                  <TimelineTitle>{a.title}</TimelineTitle>
                  <TimelineTime>{a.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
