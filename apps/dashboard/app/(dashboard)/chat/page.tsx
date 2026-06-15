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
} from '../_components/overview-bits';
import type { ConversationStatus, ConversationSummaryDto } from './_lib/types';

// Live Chat overview — "Are conversations handled fast and well?". The
// conversation pulse is LIVE from /v1/chat/conversations (open count, unassigned
// queue, the recent-conversations table — fail soft to empty); the reporting
// figures without an endpoint yet (response time, AI-vs-human resolution, CSAT,
// channel mix, agent performance) are representative data behind a
// <SampleBadge>. The /chat layout wraps this in <ModuleProvider module="chat">
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

const SAMPLE_CHANNELS = [
  { label: 'Website', value: 58 },
  { label: 'Email', value: 22 },
  { label: 'Instagram', value: 12, color: '#a78bfa' },
  { label: 'Facebook', value: 8, color: '#c4b5fd' },
] as const;

const SAMPLE_AGENTS = [
  {
    icon: <Users className="h-4 w-4" />,
    name: 'Sam Ortiz',
    hint: '142 handled · 1m 20s avg',
    csat: '4.7',
  },
  {
    icon: <Users className="h-4 w-4" />,
    name: 'You',
    hint: '88 handled · 2m 05s avg',
    csat: '4.5',
  },
  {
    icon: <Bot className="h-4 w-4" />,
    name: 'AI assistant',
    hint: '1,180 handled · instant',
    csat: '4.5',
  },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'AI resolved a chat with Maya Chen', when: 'just now' },
  { title: 'AI escalated Theo Marsh to Sam Ortiz', when: '4 min ago' },
  { title: 'You replied to Devon Walls', when: '12 min ago' },
  { title: 'Priya Nair left a 5★ CSAT rating', when: '28 min ago' },
] as const;

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

  const convos =
    (await api
      .getPaged<ConversationSummaryDto[]>('/v1/chat/conversations?take=50')
      .then((r) => r.data)
      .catch(() => [] as ConversationSummaryDto[])) ?? [];

  const isOpen = (c: ConversationSummaryDto) => c.status === 'open' || c.status === 'pending';
  const openCount = convos.filter(isOpen).length;
  const activeCount = convos.filter((c) => c.status === 'open').length;
  const unassigned = convos.filter((c) => isOpen(c) && !c.assignedToId).length;
  const recent = [...convos]
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
    .slice(0, 6);

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
            value="1m 48s"
            hint="Faster · 2m 24s → 1m 48s"
          />
          <Stat
            icon={<Bot className="h-4 w-4" />}
            label="AI-handled"
            value="64%"
            hint="Of all conversations"
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
            right={<SampleBadge />}
          >
            <DonutChart
              data={[
                { label: 'AI-resolved', value: 64, color: 'module' },
                { label: 'Human', value: 36, color: 'var(--module-active-tint)' },
              ]}
              valueFormat="percent"
              centerValue="64%"
              centerLabel="AI-resolved"
              ariaLabel="AI vs human resolution"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile value="4.6" label="CSAT · / 5" />
              <MetricTile value="6m 12s" label="Avg. handle" />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Conversations over time"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Started & resolved · last 14 days"
            right={<SampleBadge />}
          >
            <AreaChart
              data={[...SAMPLE_CONVOS_14D]}
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
              {[
                ['Conversations', '1,840'],
                ['Resolved', '1,790'],
                ['Avg. handle', '6m 12s'],
                ['CSAT', '4.6'],
              ].map(([label, value]) => (
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
            right={<SampleBadge />}
          >
            <BarList
              items={SAMPLE_CHANNELS.map((c) => ({ ...c }))}
              color="module"
              valueFormat="percent"
            />
            <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Top source ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">Website widget</span>{' '}
              — 1,067 chats
            </p>
          </OverviewCard>

          <OverviewCard
            title="Agent performance"
            icon={<Users className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            {SAMPLE_AGENTS.map((a) => (
              <OverviewRow
                key={a.name}
                icon={a.icon}
                tone="module"
                title={a.name}
                hint={a.hint}
                right={
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-[var(--module-active)]" />
                    {a.csat}
                  </span>
                }
              />
            ))}
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
