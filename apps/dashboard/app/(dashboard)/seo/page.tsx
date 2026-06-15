import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code,
  FileText,
  Gauge,
  Globe,
  Search,
  Smartphone,
  Target,
  TrendingUp,
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
  Card,
  Container,
  EmptyState,
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
import { ENTITY_LABEL, type SeoAuditRow } from '@/components/seo/types';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
} from '../_components/overview-bits';
import { RescanButton } from './_components/rescan-button';

// SEO overview — "Am I getting found, and what do I fix?". Substantially LIVE:
// the health score, pages-scored, issue counts, the issue breakdown, and the
// worst-pages table all derive from the stored audit snapshots
// (`GET /v1/seo/audits`). Search-console-style figures (organic clicks /
// impressions / CTR / position, top queries) have no backing endpoint yet and
// render as representative data behind a <SampleBadge>. The seo layout wraps
// this in <ModuleProvider module="seo">, so the page never re-wraps.

export const dynamic = 'force-dynamic';

const TWO_COL_FLIP = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TONE_CYCLE = ['warning', 'danger', 'warning', 'module'] as const;

// ── Sample data (illustrative until search-console ingestion lands) ──
const SAMPLE_TRAFFIC_14D = [
  { label: 'May 31', clicks: 360, impressions: 8200 },
  { label: 'Jun 1', clicks: 392, impressions: 8600 },
  { label: 'Jun 2', clicks: 378, impressions: 8400 },
  { label: 'Jun 3', clicks: 444, impressions: 9300 },
  { label: 'Jun 4', clicks: 430, impressions: 9100 },
  { label: 'Jun 5', clicks: 486, impressions: 9900 },
  { label: 'Jun 6', clicks: 470, impressions: 9700 },
  { label: 'Jun 7', clicks: 540, impressions: 10600 },
  { label: 'Jun 8', clicks: 522, impressions: 10400 },
  { label: 'Jun 9', clicks: 588, impressions: 11200 },
  { label: 'Jun 10', clicks: 566, impressions: 11000 },
  { label: 'Jun 11', clicks: 642, impressions: 11900 },
  { label: 'Jun 12', clicks: 620, impressions: 11700 },
  { label: 'Jun 13', clicks: 684, impressions: 12400 },
] as const;

const SAMPLE_CHECKLIST = [
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    tone: 'success',
    title: 'Sitemap submitted',
    status: 'Done',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    tone: 'success',
    title: 'Robots.txt',
    status: 'Valid',
  },
  {
    icon: <Code className="h-4 w-4" />,
    tone: 'warning',
    title: 'Structured data',
    status: 'Partial',
  },
  {
    icon: <Smartphone className="h-4 w-4" />,
    tone: 'success',
    title: 'Mobile-friendly',
    status: 'Pass',
  },
  { icon: <Zap className="h-4 w-4" />, tone: 'success', title: 'Core Web Vitals', status: 'Good' },
] as const;

const SAMPLE_QUERIES = [
  { q: 'switchback coffee', hint: 'Position 2.1 · brand', clicks: '1,240' },
  { q: 'cold brew concentrate', hint: 'Position 6.8', clicks: '680' },
  { q: 'ethiopia single origin', hint: 'Position 9.2', clicks: '540' },
  { q: 'coffee subscription', hint: 'Position 11.5', clicks: '410' },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'Audit ran — found 11 issues', when: '2 hours ago' },
  { title: 'Sam Ortiz fixed a broken link on /shop', when: 'Yesterday' },
  { title: '/subscriptions was indexed by Google', when: '2 days ago' },
  { title: 'You submitted the sitemap', when: '3 days ago' },
] as const;

function healthBand(score: number): { color: 'success' | 'warning' | 'danger'; label: string } {
  if (score >= 80) return { color: 'success', label: 'Good' };
  if (score >= 60) return { color: 'warning', label: 'Fair' };
  return { color: 'danger', label: 'Needs work' };
}

export default async function SeoPage() {
  const session = await requireSession();
  const role = session.user.role;
  const canScan = role === 'owner' || role === 'admin' || role === 'editor';

  const rows = (await api.get<SeoAuditRow[]>('/v1/seo/audits').catch(() => null)) ?? [];

  const count = rows.length;
  const avg = count ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / count) : null;
  const band = avg != null ? healthBand(avg) : null;

  // Aggregate the "top fix" recommendations into a ranked issue breakdown.
  const issueCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.fixFirst) issueCounts.set(r.fixFirst, (issueCounts.get(r.fixFirst) ?? 0) + 1);
  }
  const issues = [...issueCounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const issuesTotal = rows.filter((r) => r.fixFirst).length;

  const worst = [...rows].sort((a, b) => a.score - b.score).slice(0, 6);

  const allAuditsBtn = (
    <Button asChild variant="outline" leftIcon={<Gauge className="h-4 w-4" />}>
      <Link href="/seo/audits">All audits</Link>
    </Button>
  );

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Search className="h-5 w-5" />}
          title="SEO"
          description="Search visibility — every page scored, worst first."
          actions={
            canScan ? (
              <>
                {allAuditsBtn}
                <RescanButton size="md" />
              </>
            ) : (
              allAuditsBtn
            )
          }
        />

        {count === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Gauge className="h-5 w-5" />}
              title="No audits yet"
              description="Run a scan to score every page, product, and collection across your site — then this overview lights up with your health score, top fixes, and worst pages."
              action={canScan ? <RescanButton size="md" /> : undefined}
            />
          </Card>
        ) : (
          <>
            {/* KPI strip — pages scored + issues live; search figures sample */}
            <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
              <Stat
                icon={<Globe className="h-4 w-4" />}
                label="Pages scored"
                value={fmtNumber(count)}
                hint={avg != null ? `Average ${avg}/100` : 'Across your site'}
              />
              <Stat
                icon={<TrendingUp className="h-4 w-4" />}
                label="Organic clicks · 30d"
                value="6,840"
                hint="Clicks from search"
              />
              <Stat
                icon={<Target className="h-4 w-4" />}
                label="Avg. position"
                value="14.2"
                hint="Across ranked queries"
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Issues to fix"
                value={fmtNumber(issuesTotal)}
                hint={issuesTotal ? 'Pages with a top fix' : 'No outstanding fixes'}
              />
            </Grid>

            {/* Needs attention — live top fixes */}
            {issues.length > 0 && (
              <ActionQueue
                title="Needs attention"
                icon={<AlertTriangle className="h-4 w-4" />}
                meta={`${issuesTotal} issue${issuesTotal === 1 ? '' : 's'} across your site`}
              >
                {issues.slice(0, 4).map((issue, i) => (
                  <ActionTile
                    key={issue.label}
                    asChild
                    icon={<Search className="h-5 w-5" />}
                    count={issue.value}
                    label={issue.label}
                    tone={TONE_CYCLE[i % TONE_CYCLE.length]}
                  >
                    <Link href="/seo/audits" />
                  </ActionTile>
                ))}
              </ActionQueue>
            )}

            {/* SEO health (live score) + organic traffic (sample) */}
            <div className={TWO_COL_FLIP}>
              <OverviewCard
                title="SEO health"
                icon={<Zap className="h-4 w-4" />}
                right={
                  band ? (
                    <Badge color={band.color} variant="soft">
                      {band.label}
                    </Badge>
                  ) : undefined
                }
              >
                <p className="text-[2.1rem] leading-none font-medium">
                  {avg}
                  <span className="text-base font-normal text-[var(--color-text-tertiary)]">
                    {' '}
                    / 100
                  </span>
                </p>
                <p className="mt-1.5 mb-3 text-sm text-[var(--color-text-tertiary)]">
                  Average score across{' '}
                  <span className="text-[var(--color-text-secondary)]">{fmtNumber(count)}</span>{' '}
                  scored page{count === 1 ? '' : 's'}
                </p>
                {SAMPLE_CHECKLIST.map((c) => (
                  <OverviewRow
                    key={c.title}
                    icon={c.icon}
                    tone={c.tone}
                    title={c.title}
                    right={
                      <Badge color={c.tone} variant="soft">
                        {c.status}
                      </Badge>
                    }
                  />
                ))}
                <div className="mt-3 flex items-center gap-2">
                  <SampleBadge />
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Score is live · checklist illustrative
                  </span>
                </div>
              </OverviewCard>

              <OverviewCard
                title="Organic traffic"
                icon={<TrendingUp className="h-4 w-4" />}
                description="Clicks from search · last 14 days"
                right={<SampleBadge />}
              >
                <AreaChart
                  data={[...SAMPLE_TRAFFIC_14D]}
                  series={[
                    { key: 'clicks', label: 'Clicks', color: 'module' },
                    {
                      key: 'impressions',
                      label: 'Impressions',
                      color: 'var(--module-active-tint)',
                    },
                  ]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="Organic clicks and impressions, last 14 days"
                />
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
                  {[
                    ['Clicks', '6,840'],
                    ['Impressions', '142k'],
                    ['CTR', '4.8%'],
                    ['Avg. position', '14.2'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </OverviewCard>
            </div>

            {/* Pages to fix — live, worst score first */}
            <OverviewCard
              title="Pages to fix"
              icon={<FileText className="h-4 w-4" />}
              description="Lowest-scoring pages first — start here"
              right={<CardLink href="/seo/audits">All pages</CardLink>}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Top fix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worst.map((r) => {
                    const rb = healthBand(r.score);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-[var(--color-text-primary)]">
                            {r.title ?? '(untitled)'}
                          </div>
                          {r.path && (
                            <div className="font-mono text-xs text-[var(--module-active-text)]">
                              {r.path}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-[var(--color-text-tertiary)]">
                          {ENTITY_LABEL[r.entityType]}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge color={rb.color} variant="soft">
                            {r.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {r.fixFirst ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </OverviewCard>

            {/* Issues by type (live) + top queries + recent activity (sample) */}
            <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
              <OverviewCard
                title="Issues by type"
                icon={<AlertTriangle className="h-4 w-4" />}
                right={<CardLink href="/seo/audits">Audit</CardLink>}
              >
                {issues.length > 0 ? (
                  <BarList
                    items={issues.slice(0, 6).map((it) => ({ ...it }))}
                    color="module"
                    valueFormat="number"
                  />
                ) : (
                  <p className="py-4 text-sm text-[var(--color-text-tertiary)]">
                    No outstanding issues — every scored page is clean.
                  </p>
                )}
              </OverviewCard>

              <OverviewCard
                title="Top queries"
                icon={<Search className="h-4 w-4" />}
                right={<SampleBadge />}
              >
                {SAMPLE_QUERIES.map((q) => (
                  <OverviewRow
                    key={q.q}
                    icon={<Search className="h-4 w-4" />}
                    tone="module"
                    title={q.q}
                    hint={q.hint}
                    right={q.clicks}
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
          </>
        )}
      </Stack>
    </Container>
  );
}
