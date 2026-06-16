import Link from 'next/link';
import {
  Bot,
  CheckCircle2,
  Clock,
  Key,
  Layers,
  Link2,
  Mail,
  Package,
  Pause,
  Percent,
  Plus,
  Server,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Workflow,
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
  Code,
  Container,
  DonutChart,
  Grid,
  PageHeader,
  Stack,
  Stat,
  StatusDot,
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

// AI overview — the AI module is different in kind from the rest. Where Commerce
// shows what the store *did*, AI shows what your AI workforce *proposes* and what
// it's allowed to touch: the signature pattern is "AI proposes / you approve".
//
// The MCP surfaces are LIVE from /v1/ai/reports/* — every MCP tool call is
// audited (audit_logs, entity_type='McpToolCall'), so requests, the activity
// chart, top tools, API-key counts, and the recent-activity feed all derive
// from real usage, each liveOr-falling back to a badged sample until the tenant
// has MCP traffic. What we genuinely can't see is the client-side LLM spend
// (the agent's model/token/cost lives in the caller's LLM account, never ours),
// so the token/cost/model-mix card stays sample (workload B). The "Automations &
// agents" table is LIVE from `/v1/automations/reports/summary` (each automation +
// its 30d run count / success rate). The approval queue + connected-surfaces
// permissions stay sample until their own capture lands. Rose is the module
// identity (from the AI <ModuleProvider> in layout.tsx); warm semantic colors
// keep their meaning.

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
  automationRuns: number;
  aiActions: number;
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
// /v1/automations/reports/summary — every automation + its 30d run stats.
interface AutomationSummary {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  runs: number;
  successRate: number | null;
}
// The normalized row the "Automations & agents" table renders (live + sample).
interface AutomationRow {
  key: string;
  name: string;
  trigger: string;
  runs: string;
  success: string;
  statusLabel: string;
  paused: boolean;
}

// The normalized timeline entry — shared by live activity + the sample fallback.
interface ActivityEntry {
  key: string;
  title: string;
  when: string;
}

// Donut color cycle for the live top-tools split.
const TOOL_DONUT_COLORS = [
  'module',
  'var(--module-active-tint)',
  'var(--color-bg-muted)',
  '#fda4af',
];

// "order.created" → "Order created" for the trigger column.
function humanizeTrigger(triggerType: string): string {
  const s = triggerType.replace(/[._]/g, ' ').trim();
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : triggerType;
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

const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';
// MCP server status is the signature row: a tight status card beside a wide chart.
const MCP_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';

// ── Sample data (illustrative until /v1/ai/reports/* lands) ──

// AI activity per day, last 14 days — what the "AI activity" area chart plots.
const SAMPLE_AI_ACTIVITY_14D = [
  { label: 'May 31', actions: 100 },
  { label: 'Jun 1', actions: 108 },
  { label: 'Jun 2', actions: 96 },
  { label: 'Jun 3', actions: 132 },
  { label: 'Jun 4', actions: 124 },
  { label: 'Jun 5', actions: 160 },
  { label: 'Jun 6', actions: 144 },
  { label: 'Jun 7', actions: 188 },
  { label: 'Jun 8', actions: 172 },
  { label: 'Jun 9', actions: 216 },
  { label: 'Jun 10', actions: 204 },
  { label: 'Jun 11', actions: 244 },
  { label: 'Jun 12', actions: 236 },
  { label: 'Jun 13', actions: 268 },
] as const;

const SAMPLE_AUTOMATIONS = [
  {
    name: 'Abandoned cart recovery',
    trigger: 'Cart idle 1h',
    runs: '188',
    success: '97%',
    status: 'Active',
    paused: false,
  },
  {
    name: 'Auto-reply to reviews',
    trigger: 'New review',
    runs: '142',
    success: '95%',
    status: 'Active',
    paused: false,
  },
  {
    name: 'Low-stock reorder drafts',
    trigger: 'Stock < threshold',
    runs: '36',
    success: '100%',
    status: 'Active',
    paused: false,
  },
  {
    name: 'New-customer welcome',
    trigger: 'First order',
    runs: '486',
    success: '99%',
    status: 'Active',
    paused: false,
  },
  {
    name: 'Weekly sales digest',
    trigger: 'Mondays 8am',
    runs: '4',
    success: '100%',
    status: 'Paused',
    paused: true,
  },
] as const;

// Top MCP tools (donut) — sample until the tenant has MCP traffic.
const SAMPLE_TOP_TOOLS = [
  { label: 'product_update', value: 640, color: 'module' as const },
  { label: 'order_search', value: 420, color: 'var(--module-active-tint)' },
  { label: 'customer_get', value: 360, color: 'var(--color-bg-muted)' },
  { label: 'content_publish', value: 180, color: '#fda4af' },
];

// Recent AI activity (timeline) — sample until the tenant has MCP traffic.
const SAMPLE_ACTIVITY: ActivityEntry[] = [
  { key: 's1', title: 'MCP product_update (success)', when: '20m ago' },
  { key: 's2', title: 'MCP order_search (success)', when: '1h ago' },
  { key: 's3', title: 'MCP customer_get (success)', when: '3h ago' },
  { key: 's4', title: 'MCP content_publish (success)', when: '5h ago' },
  { key: 's5', title: 'MCP inventory_adjust (error)', when: '1d ago' },
];

export default async function AiPage() {
  await requireSession();

  const nowMs = Date.now();
  const [summary, timeseries, topTools, activity, automations] = await Promise.all([
    api.get<AiSummary>('/v1/ai/reports/summary').catch(() => null),
    api.get<AiTimeseries>('/v1/ai/reports/timeseries?grain=day').catch(() => null),
    api.get<AiTopTool[]>('/v1/ai/reports/top-tools?limit=6').catch(() => null),
    api.get<AiActivityItem[]>('/v1/ai/reports/activity?limit=6').catch(() => null),
    api.get<AutomationSummary[]>('/v1/automations/reports/summary').catch(() => null),
  ]);

  // KPI + MCP-card values — live from the summary, else the sample figure.
  const aiActionsKpi = summary ? fmtNumber(summary.aiActions) : '1,940';
  const mcpRequestsKpi = summary ? fmtNumber(summary.mcpRequests) : '8,600';
  const apiKeysRight = summary ? fmtNumber(summary.apiKeysActive) : '2';
  const apiKeysHint = summary
    ? `${fmtNumber(summary.apiKeysActive)} active · ${fmtNumber(summary.apiKeysTotal)} total`
    : '2 active · 0 expiring soon';
  const successRateLabel =
    summary?.successRate != null ? fmtPercentRatio(summary.successRate, 1) : '99.2%';

  // AI activity chart — live once the window has any MCP request.
  const tsLive = timeseries != null && timeseries.totals.requests > 0;
  const activityChart = liveOr(
    tsLive
      ? timeseries.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          actions: p.requests,
        }))
      : null,
    [...SAMPLE_AI_ACTIVITY_14D]
  );
  const activityFooter: [string, string][] = tsLive
    ? [
        ['Requests', fmtNumber(timeseries.totals.requests)],
        ['Errors', fmtNumber(timeseries.totals.errors)],
        ['Tools', fmtNumber(summary?.uniqueTools ?? 0)],
        ['Total · 30d', fmtNumber(summary?.mcpRequests ?? timeseries.totals.requests)],
      ]
    : [
        ['Copilot', '770'],
        ['Agents', '660'],
        ['Automations', '510'],
        ['Total · 30d', '1,940'],
      ];

  // Top MCP tools (donut) — live once the tenant has MCP traffic.
  const toolDonut = liveOr(
    topTools && topTools.length > 0
      ? topTools.slice(0, TOOL_DONUT_COLORS.length).map((t, i) => ({
          label: t.tool,
          value: t.calls,
          color: TOOL_DONUT_COLORS[i],
        }))
      : null,
    SAMPLE_TOP_TOOLS
  );
  const toolDonutCenter = summary ? fmtNumber(summary.mcpRequests) : '1,940';

  // Recent AI activity — live MCP tool calls, else sample.
  const activityFeed = liveOr<ActivityEntry[]>(
    activity && activity.length > 0
      ? activity.map((a) => ({
          key: a.id,
          title: `MCP ${a.tool} (${a.outcome})`,
          when: timeAgo(a.createdAt, nowMs),
        }))
      : null,
    SAMPLE_ACTIVITY
  );

  // Automations table — live list + 30d run stats, else the badged sample.
  const automationRows: AutomationRow[] | null =
    automations && automations.length > 0
      ? automations.map((a) => ({
          key: a.id,
          name: a.name,
          trigger: humanizeTrigger(a.triggerType),
          runs: fmtNumber(a.runs),
          success: a.successRate != null ? fmtPercentRatio(a.successRate, 0) : '—',
          statusLabel: a.status.charAt(0).toUpperCase() + a.status.slice(1),
          paused: a.status !== 'active',
        }))
      : null;
  const SAMPLE_AUTOMATION_ROWS: AutomationRow[] = SAMPLE_AUTOMATIONS.map((a, i) => ({
    key: `sa${i}`,
    name: a.name,
    trigger: a.trigger,
    runs: a.runs,
    success: a.success,
    statusLabel: a.status,
    paused: a.paused,
  }));
  const automationsTable = liveOr<AutomationRow[]>(automationRows, SAMPLE_AUTOMATION_ROWS);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Sparkles className="h-5 w-5" />}
          title="AI"
          description="Your AI workforce — MCP, copilots & automations."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Server className="h-4 w-4" />}>
                <Link href="/ai/mcp">MCP settings</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<Key className="h-4 w-4" />}>
                <Link href="/ai/keys">API keys</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/ai/automations/new">New automation</Link>
              </Button>
            </>
          }
        />

        {/* KPI strip — all illustrative */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="AI actions · 30d"
            value={aiActionsKpi}
            hint="MCP tool calls + automation runs"
          />
          <Stat
            icon={<Server className="h-4 w-4" />}
            label="MCP requests · 30d"
            value={mcpRequestsKpi}
            hint="Across all clients"
          />
          <Stat
            icon={<Workflow className="h-4 w-4" />}
            label="Automations active"
            value="7"
            hint="8 configured · 1 paused"
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Est. time saved"
            value="38 hrs"
            hint="This month · ≈ 1.2 hrs / day"
          />
        </Grid>
        <SampleBadge />

        {/* Waiting for your approval — the signature AI-proposes / you-approve pattern */}
        <ActionQueue
          title="Waiting for your approval"
          icon={<Sparkles className="h-4 w-4" />}
          meta="10 drafts your AI prepared"
        >
          <ActionTile
            asChild
            icon={<Package className="h-5 w-5" />}
            count={3}
            label="Restock POs drafted"
            tone="module"
          >
            <Link href="/ai/approvals?type=restock" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Star className="h-5 w-5" />}
            count={4}
            label="Review replies drafted"
            tone="module"
          >
            <Link href="/ai/approvals?type=reviews" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Mail className="h-5 w-5" />}
            count={1}
            label="Abandoned-cart email"
            tone="warning"
          >
            <Link href="/ai/approvals?type=email" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Percent className="h-5 w-5" />}
            count={2}
            label="Price-change proposals"
            tone="warning"
          >
            <Link href="/ai/approvals?type=pricing" />
          </ActionTile>
        </ActionQueue>

        {/* MCP server status (signature) + AI activity chart */}
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
            <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
              <Code className="truncate bg-transparent text-[var(--module-active-text)]">
                mcp.switchback.coffee
              </Code>
            </div>
            <OverviewRow
              icon={<Bot className="h-4 w-4" />}
              tone="module"
              title="Connected clients"
              hint="Claude · ChatGPT · internal copilot"
              right="3"
            />
            <OverviewRow
              icon={<Key className="h-4 w-4" />}
              tone="module"
              title="API keys"
              hint={apiKeysHint}
              right={apiKeysRight}
            />
            <OverviewRow
              icon={<Server className="h-4 w-4" />}
              tone="module"
              title="Requests · 30d"
              hint="Across all clients"
              right={mcpRequestsKpi}
            />
            <OverviewRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
              title="Uptime"
              hint="Last 90 days"
              right="99.99%"
            />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              leftIcon={<Link2 className="h-4 w-4" />}
            >
              <Link href="/ai/mcp/connections">Manage connections</Link>
            </Button>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="AI activity"
            icon={<TrendingUp className="h-4 w-4" />}
            description="MCP requests per day · last 14 days"
            right={activityChart.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={activityChart.data}
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
          </OverviewCard>
        </div>

        {/* Automations table + Recent AI activity */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Automations & agents"
            icon={<Workflow className="h-4 w-4" />}
            right={<CardLink href="/ai/automations">Manage all</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Automation</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Runs · 30d</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automationsTable.data.map((a) => (
                  <TableRow key={a.key}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-[var(--color-text-tertiary)]">{a.trigger}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.runs}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.success}</TableCell>
                    <TableCell>
                      {a.paused ? (
                        <Badge color="neutral" variant="soft">
                          <Pause className="mr-1 h-3 w-3" />
                          {a.statusLabel}
                        </Badge>
                      ) : (
                        <Badge color="success" variant="soft">
                          <StatusDot color="success" className="mr-1" />
                          {a.statusLabel}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {automationsTable.isSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Recent AI activity"
            icon={<Clock className="h-4 w-4" />}
            right={
              activityFeed.isSample ? (
                <SampleBadge reason="no-data" />
              ) : (
                <CardLink href="/ai/activity">Full log</CardLink>
              )
            }
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
        </div>

        {/* Connected surfaces + Usage by surface + Usage & cost */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Connected surfaces"
            icon={<Shield className="h-4 w-4" />}
            description="What your AI is allowed to act on"
            right={<CardLink href="/ai/permissions">Permissions</CardLink>}
          >
            <OverviewRow
              icon={<ShoppingCart className="h-4 w-4" />}
              tone="module"
              title="Commerce"
              hint="Orders, products, inventory"
              right={
                <Badge color="success" variant="soft">
                  <StatusDot color="success" className="mr-1" />
                  Allowed
                </Badge>
              }
            />
            <OverviewRow
              icon={<Layers className="h-4 w-4" />}
              tone="module"
              title="CMS"
              hint="Pages & content"
              right={
                <Badge color="success" variant="soft">
                  <StatusDot color="success" className="mr-1" />
                  Allowed
                </Badge>
              }
            />
            <OverviewRow
              icon={<Mail className="h-4 w-4" />}
              tone="module"
              title="Email"
              hint="Campaigns & flows"
              right={
                <Badge color="success" variant="soft">
                  <StatusDot color="success" className="mr-1" />
                  Allowed
                </Badge>
              }
            />
            <OverviewRow
              icon={<Users className="h-4 w-4" />}
              tone="module"
              title="CRM"
              hint="Customers & notes"
              right={
                <Badge color="success" variant="soft">
                  <StatusDot color="success" className="mr-1" />
                  Allowed
                </Badge>
              }
            />
            <OverviewRow
              icon={<Shield className="h-4 w-4" />}
              tone="neutral"
              title="B2B"
              hint="Quotes & accounts"
              right={
                <Badge color="neutral" variant="soft">
                  Read only
                </Badge>
              }
            />
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Top MCP tools"
            icon={<Bot className="h-4 w-4" />}
            right={toolDonut.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <DonutChart
              data={toolDonut.data}
              valueFormat="number"
              centerValue={toolDonutCenter}
              centerLabel="MCP calls"
              ariaLabel="Top MCP tools by call count"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile
                value={summary ? fmtNumber(summary.uniqueTools) : '12'}
                label="Tools used"
              />
              <MetricTile value={successRateLabel} label="Tool success" />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Usage & cost"
            icon={<Zap className="h-4 w-4" />}
            description="Model mix · this month"
            right={<CardLink href="/settings/billing">Billing</CardLink>}
          >
            <BarList
              items={[
                { label: 'Opus 4.8', value: 46 },
                { label: 'Sonnet 4.6', value: 39, color: 'var(--module-active-tint)' },
                { label: 'Haiku 4.5', value: 15, color: 'var(--color-bg-muted)' },
              ]}
              max={100}
              valueFormat="percent"
            />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-3">
              <span className="text-xs text-[var(--color-text-tertiary)]">
                <span className="font-medium text-[var(--color-text-secondary)]">≈ $42</span> this
                month · 6.1M tokens
              </span>
              <Badge color="success" variant="soft">
                Under budget
              </Badge>
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
