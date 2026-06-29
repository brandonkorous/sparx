import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Key,
  MessageSquareText,
  Plug,
  Server,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  AreaChart,
  Badge,
  Button,
  Container,
  DonutChart,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Stat,
  StatusDot,
  Text,
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
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';

// AI overview — the home for the MCP server, the one thing the "ai" module is:
// a tenant-isolated bridge that lets Claude, ChatGPT, and Copilot work with live
// business data (docs/07). It shows how the AI is being used (MCP traffic, the
// tools it calls, recent activity), the keys that authorize it, and how to
// connect a new assistant. Automations are a separate platform capability with
// their own module — they don't live here.
//
// Every section is wired to the live /v1/ai/reports/* endpoints, which aggregate
// the audit_logs trail (entity_type='McpToolCall'). A section with no data yet
// renders a compact empty state, never illustrative sample data. Rose is the
// module identity (from the AI <ModuleProvider> in layout.tsx).

export const dynamic = 'force-dynamic';

// ── Live analytics shapes (/v1/ai/reports/*) ──
interface AiSummary {
  mcpRequests: number;
  mcpSuccess: number;
  mcpError: number;
  successRate: number | null;
  uniqueTools: number;
  apiKeysActive: number;
  apiKeysTotal: number;
}
interface AiTimeseries {
  points: { bucket: string; requests: number; errors: number }[];
  totals: { requests: number; errors: number };
}
interface AiTopTool {
  tool: string;
  calls: number;
  errors: number;
  successRate: number | null;
}
interface AiActivityItem {
  id: string;
  tool: string;
  actorId: string | null;
  outcome: string;
  createdAt: string;
}

interface ActivityEntry {
  key: string;
  title: string;
  when: string;
}

// Donut color cycle for the live top-tools split (rose family + neutral).
const TOOL_DONUT_COLORS = [
  'module',
  'var(--module-active-tint)',
  'var(--color-bg-muted)',
  '#fda4af',
];

// How a tenant connects an assistant — the three steps every MCP client follows.
const CONNECT_STEPS: { title: string; body: string }[] = [
  {
    title: 'Create a scoped API key',
    body: 'Choose exactly what the assistant may read and write — your data stays under the scopes you grant.',
  },
  {
    title: 'Add sparx as an MCP server',
    body: 'Paste the key into Claude, ChatGPT, or Microsoft Copilot as a Model Context Protocol connection.',
  },
  {
    title: 'Put your AI to work',
    body: 'Ask it about orders, customers, or inventory. Every call is tenant-isolated and audited below.',
  },
];

// Compact relative time for the activity feed (server-rendered).
function timeAgo(iso: string, nowMs: number): string {
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// MCP server status is the signature row: a tight status card beside a wide chart.
const MCP_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-2';

export default async function AiPage() {
  await requireSession();

  const nowMs = Date.now();
  const [summary, timeseries, topTools, activity] = await Promise.all([
    api.get<AiSummary>('/v1/ai/reports/summary').catch(() => null),
    api.get<AiTimeseries>('/v1/ai/reports/timeseries?grain=day').catch(() => null),
    api.get<AiTopTool[]>('/v1/ai/reports/top-tools?limit=6').catch(() => null),
    api.get<AiActivityItem[]>('/v1/ai/reports/activity?limit=6').catch(() => null),
  ]);

  // KPI + MCP-card values — live from the summary.
  const mcpRequestsKpi = summary ? fmtNumber(summary.mcpRequests) : '—';
  const toolsUsedKpi = summary ? fmtNumber(summary.uniqueTools) : '—';
  const apiKeysKpi = summary ? fmtNumber(summary.apiKeysActive) : '—';
  const apiKeysHint = summary
    ? `${fmtNumber(summary.apiKeysActive)} active · ${fmtNumber(summary.apiKeysTotal)} total`
    : 'No API keys yet';
  const successRateLabel =
    summary?.successRate != null ? fmtPercentRatio(summary.successRate, 1) : '—';
  const hasKeys = (summary?.apiKeysTotal ?? 0) > 0;

  // AI activity chart — live once the window has any MCP request.
  const tsLive = timeseries != null && timeseries.totals.requests > 0;
  const activityChart = tsLive
    ? timeseries.points.map((p) => ({
        label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        actions: p.requests,
      }))
    : [];
  const activityFooter: [string, string][] = tsLive
    ? [
        ['Requests', fmtNumber(timeseries.totals.requests)],
        ['Errors', fmtNumber(timeseries.totals.errors)],
        ['Tools', fmtNumber(summary?.uniqueTools ?? 0)],
        ['Total · 30d', fmtNumber(summary?.mcpRequests ?? timeseries.totals.requests)],
      ]
    : [];

  // Top MCP tools (donut) — live once the tenant has MCP traffic.
  const toolDonut =
    topTools && topTools.length > 0
      ? topTools.slice(0, TOOL_DONUT_COLORS.length).map((t, i) => ({
          label: t.tool,
          value: t.calls,
          color: TOOL_DONUT_COLORS[i],
        }))
      : [];
  const toolDonutCenter = summary ? fmtNumber(summary.mcpRequests) : '—';

  // Recent AI activity — live MCP tool calls.
  const activityFeed: ActivityEntry[] =
    activity && activity.length > 0
      ? activity.map((a) => ({
          key: a.id,
          title: `MCP ${a.tool} (${a.outcome})`,
          when: timeAgo(a.createdAt, nowMs),
        }))
      : [];

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Bot className="h-5 w-5" />}
          title="AI"
          description="Your MCP server — let Claude, ChatGPT, and Copilot work with your live business data."
          actions={
            <Stack direction="row" gap={2} wrap>
              <Button
                asChild
                variant="outline"
                color="module"
                leftIcon={<MessageSquareText className="h-4 w-4" />}
              >
                <Link href="/ai/prompts">Prompt library</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                color="module"
                leftIcon={<Wrench className="h-4 w-4" />}
              >
                <Link href="/ai/tools">MCP tools</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Key className="h-4 w-4" />}>
                <Link href="/settings/ai-integrations">Manage API keys</Link>
              </Button>
            </Stack>
          }
        />

        {/* Headline KPIs — MCP usage + success from the summary, all live. */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Server className="h-4 w-4" />}
            label="MCP requests · 30d"
            value={mcpRequestsKpi}
            hint="Across all assistants"
          />
          <Stat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Tool success"
            value={successRateLabel}
            hint="Last 30 days"
          />
          <Stat
            icon={<Bot className="h-4 w-4" />}
            label="Tools used"
            value={toolsUsedKpi}
            hint="Distinct MCP tools · 30d"
          />
          <Stat
            icon={<Key className="h-4 w-4" />}
            label="API keys"
            value={apiKeysKpi}
            hint={apiKeysHint}
          />
        </Grid>

        {/* MCP server status (signature, tinted) + AI activity chart */}
        <div className={MCP_ROW}>
          <OverviewCard
            title="MCP server"
            icon={<Server className="h-4 w-4" />}
            right={
              <Badge color="success" variant="soft">
                <StatusDot color="success" className="mr-1" />
                Online
              </Badge>
            }
          >
            <OverviewRow
              icon={<Key className="h-4 w-4" />}
              tone="module"
              title="API keys"
              hint={apiKeysHint}
              right={apiKeysKpi}
            />
            <OverviewRow
              icon={<Server className="h-4 w-4" />}
              tone="module"
              title="Requests · 30d"
              hint="Across all assistants"
              right={mcpRequestsKpi}
            />
            <OverviewRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
              title="Tool success"
              hint="Last 30 days"
              right={successRateLabel}
            />
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/settings/ai-integrations">Manage API keys</Link>
            </Button>
          </OverviewCard>

          <OverviewCard
            title="AI activity"
            icon={<TrendingUp className="h-4 w-4" />}
            description={tsLive ? 'MCP requests per day · last 14 days' : undefined}
            plain
          >
            {activityChart.length ? (
              <>
                <AreaChart
                  data={activityChart}
                  series={[{ key: 'actions', label: 'MCP requests', color: 'module' }]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="MCP requests per day, last 14 days"
                />
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
                  {activityFooter.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No AI activity yet"
                description="MCP requests appear here as your assistants start calling. Connect one below to begin."
              />
            )}
          </OverviewCard>
        </div>

        {/* Recent AI activity + Top MCP tools */}
        <div className={TWO_COL}>
          <OverviewCard title="Recent AI activity" icon={<Clock className="h-4 w-4" />} plain>
            {activityFeed.length ? (
              <Timeline>
                {activityFeed.map((a, i) => (
                  <TimelineItem key={a.key} showConnector={i < activityFeed.length - 1}>
                    <TimelineTitle>{a.title}</TimelineTitle>
                    <TimelineTime>{a.when}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No recent activity"
                description="Your AI's most recent MCP tool calls will show up here."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Top MCP tools" icon={<Bot className="h-4 w-4" />} plain>
            {toolDonut.length ? (
              <>
                <DonutChart
                  data={toolDonut}
                  valueFormat="number"
                  centerValue={toolDonutCenter}
                  centerLabel="MCP calls"
                  ariaLabel="Top MCP tools by call count"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricTile value={toolsUsedKpi} label="Tools used" />
                  <MetricTile value={successRateLabel} label="Tool success" />
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Bot className="h-5 w-5" />}
                title="No tool calls yet"
                description="The tools your AI calls most will rank here."
              />
            )}
          </OverviewCard>
        </div>

        {/* Connect an assistant — the page's call to action (and empty-state hero). */}
        <OverviewCard
          title="Connect your AI assistant"
          icon={<Plug className="h-4 w-4" />}
          description="sparx speaks MCP, the open standard for Claude, ChatGPT, and Microsoft Copilot."
          right={<CardLink href="/settings/ai-integrations">API keys</CardLink>}
          plain
        >
          <div className="grid gap-5 sm:grid-cols-3">
            {CONNECT_STEPS.map((step, i) => (
              <Stack key={step.title} gap={2}>
                <Stack direction="row" align="center" gap={2}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--module-active-tint)] text-xs font-semibold text-[var(--module-active)]">
                    {i + 1}
                  </span>
                  <Text size="sm" weight="medium">
                    {step.title}
                  </Text>
                </Stack>
                <Text size="sm" variant="muted">
                  {step.body}
                </Text>
              </Stack>
            ))}
          </div>
          <Stack direction="row" align="center" gap={3} wrap className="mt-5">
            <Button asChild color="module" leftIcon={<Key className="h-4 w-4" />}>
              <Link href="/settings/ai-integrations">
                {hasKeys ? 'Manage API keys' : 'Create your first key'}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Stack direction="row" align="center" gap={2}>
              <ShieldCheck className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <Text size="xs" variant="muted">
                Keys are scoped and revocable — the assistant only does what you allow.
              </Text>
            </Stack>
          </Stack>
        </OverviewCard>
      </Stack>
    </Container>
  );
}
