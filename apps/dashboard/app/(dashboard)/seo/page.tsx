import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Globe,
  Search,
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
  fmtPercentRatio,
  liveOr,
} from '../_components/overview-bits';
import { RescanButton } from './_components/rescan-button';
import { SearchConsoleControl, type ConnectionView } from './_components/search-console-control';

// SEO overview — "Am I getting found, and what do I fix?". Substantially LIVE:
// the health score, pages-scored, issue counts, the issue breakdown, and the
// worst-pages table all derive from the stored audit snapshots
// (`GET /v1/seo/audits`); the technical checklist rolls every page's audit
// checks up site-wide (`GET /v1/seo/reports/checklist`) and the activity feed
// reads recent audit runs (`GET /v1/seo/reports/activity`). Organic-search
// figures (clicks / impressions / CTR / position, top queries) come from Google
// Search Console once the tenant connects it (`GET /v1/seo/organic/*`); until
// then — or while the platform hasn't provisioned the OAuth client — they render
// as representative data behind a <SampleBadge> with a "Connect Search Console"
// CTA. The seo layout wraps this in <ModuleProvider module="seo">, so the page
// never re-wraps.

export const dynamic = 'force-dynamic';

const TWO_COL_FLIP = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TONE_CYCLE = ['warning', 'danger', 'warning', 'module'] as const;

// ── Live analytics shapes (/v1/seo/reports/*) ──
type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'info';

interface ChecklistCheck {
  id: string;
  label: string;
  category: string;
  status: ChecklistStatus;
  pagesPass: number;
  pagesWarn: number;
  pagesFail: number;
  pagesScored: number;
  passRate: number | null;
}

interface SeoChecklist {
  summary: {
    pagesScored: number;
    checks: number;
    passing: number;
    warning: number;
    failing: number;
  };
  checks: ChecklistCheck[];
}

interface SeoActivityItem {
  id: string;
  entityType: string;
  title: string | null;
  path: string | null;
  score: number;
  grade: string;
  fixFirst: string | null;
  computedAt: string;
}

// ── Search Console organic shapes (/v1/seo/search-console/status, /organic/*) ──
interface GscStatus {
  configured: boolean;
  connection: ConnectionView | null;
}
interface OrganicSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}
interface OrganicPoint {
  bucket: string;
  clicks: number;
  impressions: number;
}
interface OrganicTimeseries {
  points: OrganicPoint[];
  totals: { clicks: number; impressions: number };
}
interface OrganicQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
// The normalized query row the cards render (shared by live + sample). The chart
// row type is inferred from inline literals at the liveOr call (so it satisfies
// AreaChart's Record<string, unknown> data constraint without a named type).
interface OrganicQueryRow {
  q: string;
  hint: string;
  clicks: string;
}

// The normalized rows the cards render — shared by live + sample so liveOr can
// fall back cleanly.
interface ChecklistRow {
  key: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  title: string;
  status: string;
  hint: string | null;
}
interface ActivityEntry {
  key: string;
  title: string;
  when: string;
}

// Check status → row tone + badge label.
const CHECK_STATUS_META: Record<
  ChecklistStatus,
  { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  pass: { tone: 'success', label: 'Good' },
  warn: { tone: 'warning', label: 'Partial' },
  fail: { tone: 'danger', label: 'Needs work' },
  info: { tone: 'neutral', label: 'Info' },
};

// Short UTC day label ("Jun 13") for the organic-traffic chart x-axis.
function shortDay(bucket: string): string {
  return new Date(`${bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
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

const SAMPLE_CHECKLIST: ChecklistRow[] = [
  { key: 'c1', tone: 'success', title: 'Meta title is set', status: 'Good', hint: '18/18 pages' },
  {
    key: 'c2',
    tone: 'warning',
    title: 'Description length',
    status: 'Partial',
    hint: '6/18 pages',
  },
  {
    key: 'c3',
    tone: 'warning',
    title: 'Structured data (JSON-LD)',
    status: 'Partial',
    hint: '10/18 pages',
  },
  { key: 'c4', tone: 'danger', title: 'Image alt text', status: 'Needs work', hint: '11/18 pages' },
  { key: 'c5', tone: 'success', title: 'Page is indexable', status: 'Good', hint: '18/18 pages' },
];

const SAMPLE_QUERIES = [
  { q: 'switchback coffee', hint: 'Position 2.1 · brand', clicks: '1,240' },
  { q: 'cold brew concentrate', hint: 'Position 6.8', clicks: '680' },
  { q: 'ethiopia single origin', hint: 'Position 9.2', clicks: '540' },
  { q: 'coffee subscription', hint: 'Position 11.5', clicks: '410' },
] as const;

const SAMPLE_ACTIVITY: ActivityEntry[] = [
  { key: 's1', title: 'Audited Home — scored 88/100', when: '2h ago' },
  { key: 's2', title: 'Audited Cold Brew Concentrate — scored 72/100', when: '1d ago' },
  { key: 's3', title: 'Audited Subscriptions — scored 64/100', when: '2d ago' },
  { key: 's4', title: 'Audited Shop — scored 91/100', when: '3d ago' },
];

function healthBand(score: number): { color: 'success' | 'warning' | 'danger'; label: string } {
  if (score >= 80) return { color: 'success', label: 'Good' };
  if (score >= 60) return { color: 'warning', label: 'Fair' };
  return { color: 'danger', label: 'Needs work' };
}

export default async function SeoPage() {
  const session = await requireSession();
  const role = session.user.role;
  const canScan = role === 'owner' || role === 'admin' || role === 'editor';

  const nowMs = Date.now();
  const [rows, checklist, activity, gsc, organicSummary, organicSeries, organicQueries] =
    await Promise.all([
      api
        .get<SeoAuditRow[]>('/v1/seo/audits')
        .then((r) => r ?? [])
        .catch(() => [] as SeoAuditRow[]),
      api.get<SeoChecklist>('/v1/seo/reports/checklist').catch(() => null),
      api.get<SeoActivityItem[]>('/v1/seo/reports/activity?limit=8').catch(() => null),
      api.get<GscStatus>('/v1/seo/search-console/status').catch(() => null),
      api.get<OrganicSummary>('/v1/seo/organic/summary').catch(() => null),
      api.get<OrganicTimeseries>('/v1/seo/organic/timeseries').catch(() => null),
      api.get<OrganicQuery[]>('/v1/seo/organic/top-queries?limit=4').catch(() => null),
    ]);

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

  // Technical checklist — site-wide roll-up of every page's audit checks,
  // attention-first; falls back to the representative sample until audited.
  const checklistRows: ChecklistRow[] | null =
    checklist && checklist.checks.length > 0
      ? checklist.checks.slice(0, 7).map((c) => {
          const meta = CHECK_STATUS_META[c.status];
          return {
            key: c.id,
            tone: meta.tone,
            title: c.label,
            status: meta.label,
            hint:
              c.pagesScored > 0
                ? `${fmtNumber(c.pagesPass)}/${fmtNumber(c.pagesScored)} pages`
                : null,
          };
        })
      : null;
  const checklistDisplay = liveOr<ChecklistRow[]>(checklistRows, SAMPLE_CHECKLIST);

  // Activity feed — recent audit runs, else the representative sample.
  const activityRows: ActivityEntry[] | null =
    activity && activity.length > 0
      ? activity.map((a) => {
          const label = ENTITY_LABEL[a.entityType as keyof typeof ENTITY_LABEL] ?? a.entityType;
          return {
            key: a.id,
            title: `Audited ${a.title ?? label} — scored ${a.score}/100`,
            when: timeAgo(a.computedAt, nowMs),
          };
        })
      : null;
  const activityFeed = liveOr<ActivityEntry[]>(activityRows, SAMPLE_ACTIVITY);

  // ── Organic search (Search Console) — live when connected + has data ──
  const gscConfigured = gsc?.configured ?? false;
  const gscConnection = gsc?.connection ?? null;
  const organicLive =
    gscConnection?.status === 'connected' && (organicSummary?.impressions ?? 0) > 0;

  const trafficDisplay = liveOr(
    organicLive && organicSeries && organicSeries.points.length > 0
      ? organicSeries.points.map((p) => ({
          label: shortDay(p.bucket),
          clicks: p.clicks,
          impressions: p.impressions,
        }))
      : null,
    [...SAMPLE_TRAFFIC_14D]
  );

  const organicQueryRows: OrganicQueryRow[] | null =
    organicLive && organicQueries && organicQueries.length > 0
      ? organicQueries.map((q) => ({
          q: q.query,
          hint: `Position ${q.position.toFixed(1)} · ${fmtPercentRatio(q.ctr)} CTR`,
          clicks: fmtNumber(q.clicks),
        }))
      : null;
  const queriesDisplay = liveOr<OrganicQueryRow[]>(organicQueryRows, [...SAMPLE_QUERIES]);

  // KPI + footer figures: live summary when connected, else the sample numbers.
  const organicKpis = organicLive
    ? {
        clicks: fmtNumber(organicSummary?.clicks),
        impressions: fmtNumber(organicSummary?.impressions),
        ctr: fmtPercentRatio(organicSummary?.ctr),
        position: (organicSummary?.avgPosition ?? 0).toFixed(1),
      }
    : { clicks: '6,840', impressions: '142k', ctr: '4.8%', position: '14.2' };

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
            {/* KPI strip — pages scored + issues live; organic live once Search
                Console is connected, else representative figures */}
            <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
              <Stat
                icon={<Globe className="h-4 w-4" />}
                label="Pages scored"
                value={fmtNumber(count)}
                hint={avg != null ? `Average ${avg}/100` : 'Across your site'}
              />
              <Stat
                icon={<TrendingUp className="h-4 w-4" />}
                label="Organic clicks · 28d"
                value={organicKpis.clicks}
                hint={organicLive ? 'Clicks from search' : 'Sample · connect Search Console'}
              />
              <Stat
                icon={<Target className="h-4 w-4" />}
                label="Avg. position"
                value={organicKpis.position}
                hint={organicLive ? 'Across ranked queries' : 'Sample · connect Search Console'}
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
                {checklistDisplay.data.map((c) => (
                  <OverviewRow
                    key={c.key}
                    icon={
                      c.tone === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )
                    }
                    tone={c.tone}
                    title={c.title}
                    hint={c.hint ?? undefined}
                    right={
                      <Badge color={c.tone} variant="soft">
                        {c.status}
                      </Badge>
                    }
                  />
                ))}
                {checklistDisplay.isSample && (
                  <div className="mt-3">
                    <SampleBadge reason="no-data" />
                  </div>
                )}
              </OverviewCard>

              <OverviewCard
                title="Organic traffic"
                icon={<TrendingUp className="h-4 w-4" />}
                description={`Clicks from search · last ${organicLive ? '28' : '14'} days`}
                right={
                  <SearchConsoleControl configured={gscConfigured} connection={gscConnection} />
                }
              >
                <AreaChart
                  data={trafficDisplay.data}
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
                  ariaLabel="Organic clicks and impressions"
                />
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
                  {[
                    ['Clicks', organicKpis.clicks],
                    ['Impressions', organicKpis.impressions],
                    ['CTR', organicKpis.ctr],
                    ['Avg. position', organicKpis.position],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
                {trafficDisplay.isSample && (
                  <div className="mt-3">
                    <SampleBadge reason="no-data" />
                  </div>
                )}
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
                right={queriesDisplay.isSample ? <SampleBadge reason="no-data" /> : undefined}
              >
                {queriesDisplay.data.map((q) => (
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
          </>
        )}
      </Stack>
    </Container>
  );
}
