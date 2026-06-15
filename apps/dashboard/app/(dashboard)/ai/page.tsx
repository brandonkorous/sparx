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

import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
} from '../_components/overview-bits';

// AI overview — the AI module is different in kind from the rest. Where Commerce
// shows what the store *did*, AI shows what your AI workforce *proposes* and what
// it's allowed to touch: the signature pattern is "AI proposes / you approve".
//
// AI has no reliable metrics endpoints yet, so EVERY figure on this page is
// illustrative — defined in the local SAMPLE_* constants below and surfaced
// behind a <SampleBadge> per card, the dashboard's sanctioned interim until the
// /v1/ai/reports/* endpoints land. Rose is the module identity (from the AI
// <ModuleProvider> in layout.tsx); warm semantic colors (warning/danger) keep
// their meaning. No props re-skin a control; module color flows via color="module".

export const dynamic = 'force-dynamic';

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

export default async function AiPage() {
  await requireSession();

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
            value="1,940"
            hint="Copilot, agents & automations"
          />
          <Stat
            icon={<Server className="h-4 w-4" />}
            label="MCP requests · 30d"
            value="8,600"
            hint="≈ 287 / day across all clients"
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
              hint="2 active · 0 expiring soon"
              right="2"
            />
            <OverviewRow
              icon={<Server className="h-4 w-4" />}
              tone="module"
              title="Requests · 30d"
              hint="Across all clients"
              right="8,600"
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
            description="Actions per day · last 14 days"
            right={<SampleBadge />}
          >
            <AreaChart
              data={SAMPLE_AI_ACTIVITY_14D}
              series={[{ key: 'actions', label: 'AI actions', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat="number"
              ariaLabel="AI actions per day, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Copilot', '770'],
                ['Agents', '660'],
                ['Automations', '510'],
                ['Total · 30d', '1,940'],
              ].map(([label, value]) => (
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
                {SAMPLE_AUTOMATIONS.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-[var(--color-text-tertiary)]">{a.trigger}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.runs}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.success}</TableCell>
                    <TableCell>
                      {a.paused ? (
                        <Badge color="neutral" variant="soft">
                          <Pause className="mr-1 h-3 w-3" />
                          {a.status}
                        </Badge>
                      ) : (
                        <Badge color="success" variant="soft">
                          <StatusDot color="success" className="mr-1" />
                          {a.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Recent AI activity"
            icon={<Clock className="h-4 w-4" />}
            right={<CardLink href="/ai/activity">Full log</CardLink>}
          >
            <Timeline>
              <TimelineItem>
                <TimelineTitle>Copilot drafted 4 review replies</TimelineTitle>
                <TimelineTime>20m ago</TimelineTime>
              </TimelineItem>
              <TimelineItem>
                <TimelineTitle>MCP agent (Claude) updated 12 product descriptions</TimelineTitle>
                <TimelineTime>1h ago</TimelineTime>
              </TimelineItem>
              <TimelineItem>
                <TimelineTitle>Automation recovered a cart → $48 order</TimelineTitle>
                <TimelineTime>3h ago</TimelineTime>
              </TimelineItem>
              <TimelineItem>
                <TimelineTitle>Copilot answered “top products last week?”</TimelineTitle>
                <TimelineTime>5h ago</TimelineTime>
              </TimelineItem>
              <TimelineItem showConnector={false}>
                <TimelineTitle>MCP agent (ChatGPT) exported the orders report</TimelineTitle>
                <TimelineTime>1d ago</TimelineTime>
              </TimelineItem>
            </Timeline>
            <div className="mt-3">
              <SampleBadge />
            </div>
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
            title="Usage by surface"
            icon={<Bot className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <DonutChart
              data={[
                { label: 'Copilot', value: 40, color: 'module' },
                { label: 'MCP agents', value: 34, color: 'var(--module-active-tint)' },
                { label: 'Automations', value: 26, color: 'var(--color-bg-muted)' },
              ]}
              valueFormat="percent"
              centerValue="1,940"
              centerLabel="actions"
              ariaLabel="AI usage by surface"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile value="3" label="Active clients" />
              <MetricTile value="99.2%" label="Action success" />
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
