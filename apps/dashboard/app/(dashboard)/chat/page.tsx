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
  BarList,
  DonutChart,
  PageHeader,
  Timeline,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';
import {
  Badge,
  Button,
  EmptyState,
  Stat,
  StatDesc,
  StatFigure,
  Stats,
  StatTitle,
  StatValue,
  Table,
} from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';
import type { ConversationStatus, ConversationSummaryDto } from './_lib/types';

// Live Chat overview — "Are conversations handled fast and well?". The
// conversation pulse, the volume timeseries, the AI-vs-human resolution split,
// channel mix, agent performance, and the activity feed are all LIVE: the
// recent-conversations table + counts from /v1/chat/conversations, and the
// reporting figures from /v1/chat/analytics/* (summary, timeseries, agents,
// activity). Each section renders a compact empty state until the tenant has
// chat history. CSAT has no rating-capture model yet (workload B, docs/97 §4),
// so it reads "—". The /chat layout wraps this in <ModuleProvider module="chat">
// + the module gate, so the page never re-wraps. The working inbox lives at
// /chat/inbox.

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

// The normalized rows the cards render from the live analytics responses.
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

  // KPI values — live from the summary, else an em dash. CSAT has no capture
  // model yet, so it reads "—".
  const avgFirstResponse = fmtDuration(summary?.avgFirstResponseSeconds);
  const aiHandled = summary?.aiHandledPct != null ? fmtPercentRatio(summary.aiHandledPct, 0) : '—';

  // AI-vs-human resolution split — live once any conversation has resolved.
  const resolvedClassified = (summary?.aiResolved ?? 0) + (summary?.humanResolved ?? 0);
  const resolutionLive = summary != null && resolvedClassified > 0;
  const aiShare = resolutionLive
    ? Math.round(((summary?.aiResolved ?? 0) / resolvedClassified) * 100)
    : 0;
  const donutData = [
    { label: 'AI-resolved', value: summary?.aiResolved ?? 0, color: 'module' },
    {
      label: 'Human',
      value: summary?.humanResolved ?? 0,
      color: 'color-mix(in oklch, var(--color-module) 14%, transparent)',
    },
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

  // By channel — live source mix, else null (renders the empty state).
  const channelRows: ChannelRow[] | null =
    summary && summary.byChannel.length > 0
      ? summary.byChannel.map((c) => ({
          label: CHANNEL_LABEL[c.source] ?? c.source,
          value: c.count,
        }))
      : null;

  // Agent performance — first-responder rollup, else null.
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

  // Recent activity — live message feed, else null.
  const activityRows: ActivityEntry[] | null =
    activity && activity.length > 0
      ? activity.map((a) => ({
          key: a.id,
          title: `${activityVerb(a.senderType, a.aiGenerated)} ${a.who}`,
          when: timeAgo(a.createdAt, nowMs),
        }))
      : null;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<MessagesSquare className="h-5 w-5" />}
          title="Live Chat"
          description="Conversations & inbox — across every channel."
          actions={
            <>
              <Button
                render={<Link href="/settings/chat" />}
                variant="outline"
                iconStart={<Settings className="h-4 w-4" />}
              >
                Settings
              </Button>
              <Button
                render={<Link href="/settings/chat" />}
                variant="outline"
                iconStart={<Zap className="h-4 w-4" />}
              >
                Quick replies
              </Button>
              <Button
                render={<Link href="/chat/inbox" />}
                color="module"
                iconStart={<Inbox className="h-4 w-4" />}
              >
                Open inbox
              </Button>
            </>
          }
        />

        {/* KPI strip — conversation counts live, quality metrics sample */}
        <Stats className="w-full flex-wrap [&>*]:flex-1">
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <MessagesSquare className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Open conversations</StatTitle>
            <StatValue>{fmtNumber(openCount)}</StatValue>
            <StatDesc>{`${fmtNumber(unassigned)} unassigned · ${fmtNumber(activeCount)} active`}</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Clock className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Avg. first response</StatTitle>
            <StatValue>{avgFirstResponse}</StatValue>
            <StatDesc>First staff/AI reply · 30d</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Bot className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>AI-handled</StatTitle>
            <StatValue>{aiHandled}</StatValue>
            <StatDesc>Of resolved conversations</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Star className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>CSAT</StatTitle>
            <StatValue>—</StatValue>
            <StatDesc>No ratings captured yet</StatDesc>
          </Stat>
        </Stats>

        {/* Needs attention — unassigned + active open conversations, both live */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          columns={2}
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
            count={activeCount}
            label="Active conversations"
            tone="warning"
          >
            <Link href="/chat/inbox" />
          </ActionTile>
        </ActionQueue>

        {/* Resolution: AI vs human + conversations over time */}
        <div className={TWO_COL_FLIP}>
          <OverviewCard title="AI vs human" icon={<Bot className="h-4 w-4" />} plain>
            {resolutionLive ? (
              <>
                <DonutChart
                  data={donutData}
                  valueFormat="number"
                  centerValue={`${aiShare}%`}
                  centerLabel="AI-resolved"
                  ariaLabel="AI vs human resolution"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricTile
                    value={fmtNumber(summary?.resolvedInRange ?? 0)}
                    label="Resolved · 30d"
                  />
                  <MetricTile value={avgFirstResponse} label="Avg. response" />
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Bot className="h-5 w-5" />}
                title="No resolutions yet"
                description="The AI-vs-human split appears once conversations start resolving."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Conversations over time"
            icon={<TrendingUp className="h-4 w-4" />}
            description={tsPoints ? 'Started & resolved · last 14 days' : undefined}
            plain
          >
            {tsPoints ? (
              <>
                <AreaChart
                  data={tsPoints}
                  series={[
                    { key: 'started', label: 'Started', color: 'module' },
                    {
                      key: 'resolved',
                      label: 'Resolved',
                      color: 'color-mix(in oklch, var(--color-module) 14%, transparent)',
                    },
                  ]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="Conversations started and resolved, last 14 days"
                />
                <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  {(
                    [
                      ['Started', fmtNumber(timeseries?.totals.started ?? 0)],
                      ['Resolved', fmtNumber(timeseries?.totals.resolved ?? 0)],
                      ['Avg. response', avgFirstResponse],
                      ['AI-handled', aiHandled],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <div className="text-base-content text-xs">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No conversation volume yet"
                description="Daily started and resolved counts chart here as chats come in."
              />
            )}
          </OverviewCard>
        </div>

        {/* Recent conversations — live */}
        <OverviewCard
          title="Recent conversations"
          icon={<MessagesSquare className="h-4 w-4" />}
          right={<CardLink href="/chat/inbox">Open inbox</CardLink>}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare className="h-5 w-5" />}
              title="No conversations yet"
              description="Conversations appear here as customers reach out across your channels."
              actions={
                <Button variant="outline" size="sm" render={<Link href="/chat/inbox" />}>
                  Open inbox
                </Button>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Last message</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th className="text-right">Wait</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const meta = STATUS_META[c.status];
                  return (
                    <tr key={c.id}>
                      <td className="font-medium">
                        <Link
                          href={`/chat/inbox/${c.id}`}
                          className="text-base-content hover:text-module"
                        >
                          {c.customerName ?? c.customerEmail ?? 'Anonymous visitor'}
                        </Link>
                        {c.unreadStaff > 0 && (
                          <Badge color="danger" variant="solid" size="sm" className="ml-2">
                            {c.unreadStaff}
                          </Badge>
                        )}
                      </td>
                      <td className="text-base-content max-w-[22rem] truncate">
                        {c.lastMessageSnippet ?? 'No messages yet'}
                      </td>
                      <td className="text-base-content capitalize">{c.source}</td>
                      <td>
                        <Badge color={meta.color} variant="soft">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="text-base-content text-right tabular-nums">{waitLabel(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </OverviewCard>

        {/* By channel + agent performance + recent activity */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OverviewCard title="By channel" icon={<TrendingUp className="h-4 w-4" />} plain>
            {channelRows ? (
              <>
                <BarList items={channelRows} color="module" valueFormat="number" />
                <p className="border-base-300 text-base-content mt-4 border-t pt-3 text-xs">
                  Top source ·{' '}
                  <span className="text-base-content font-medium">
                    {channelRows[0]?.label ?? '—'}
                  </span>{' '}
                  — {fmtNumber(channelRows[0]?.value ?? 0)} chats
                </p>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No channel data yet"
                description="Conversation volume by source appears as chats arrive."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Agent performance" icon={<Users className="h-4 w-4" />} plain>
            {agentRows ? (
              agentRows.map((a) => (
                <OverviewRow
                  key={a.key}
                  icon={a.isAi ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  tone="module"
                  title={a.name}
                  hint={a.hint}
                />
              ))
            ) : (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No agent activity yet"
                description="First-responder stats appear once your team handles chats."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            {activityRows ? (
              <Timeline>
                {activityRows.map((a, i) => (
                  <TimelineItem key={a.key} showConnector={i < activityRows.length - 1}>
                    <TimelineTitle>{a.title}</TimelineTitle>
                    <TimelineTime>{a.when}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No recent activity"
                description="Replies and new messages show up here as they happen."
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
