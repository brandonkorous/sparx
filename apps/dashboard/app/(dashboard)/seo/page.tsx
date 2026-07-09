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
  BarList,
  PageHeader,
  Stat,
  Timeline,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';
import { Badge, Button, Card, CardBody, EmptyState, Table } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { ENTITY_LABEL, type SeoAuditRow } from '@/components/seo/types';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';
import { RescanButton } from './_components/rescan-button';
import { SearchConsoleControl, type ConnectionView } from './_components/search-console-control';

// SEO overview — "Am I getting found, and what do I fix?". Fully LIVE: the health
// score, pages-scored, issue counts, the issue breakdown, and the worst-pages
// table all derive from the stored audit snapshots (`GET /v1/seo/audits`); the
// technical checklist rolls every page's audit checks up site-wide
// (`GET /v1/seo/reports/checklist`) and the activity feed reads recent audit runs
// (`GET /v1/seo/reports/activity`). Organic-search figures (clicks / impressions
// / CTR / position, top queries) come from Google Search Console once the tenant
// connects it (`GET /v1/seo/organic/*`); until then each organic section renders
// a compact empty state with a "Connect Search Console" affordance rather than
// illustrative data. The seo layout wraps this in <ModuleProvider module="seo">,
// so the page never re-wraps — making this a single tint scope where only the
// "Pages to fix" headline card stays tinted.

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

// The normalized rows the cards render from live data.
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
interface OrganicQueryRow {
  q: string;
  hint: string;
  clicks: string;
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
  // attention-first; empty until pages are scored.
  const checklistRows: ChecklistRow[] =
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
      : [];

  // Activity feed — recent audit runs.
  const activityRows: ActivityEntry[] =
    activity && activity.length > 0
      ? activity.map((a) => {
          const label = ENTITY_LABEL[a.entityType as keyof typeof ENTITY_LABEL] ?? a.entityType;
          return {
            key: a.id,
            title: `Audited ${a.title ?? label} — scored ${a.score}/100`,
            when: timeAgo(a.computedAt, nowMs),
          };
        })
      : [];

  // ── Organic search (Search Console) — live when connected + has data ──
  const gscConfigured = gsc?.configured ?? false;
  const gscConnection = gsc?.connection ?? null;
  const organicLive =
    gscConnection?.status === 'connected' && (organicSummary?.impressions ?? 0) > 0;

  const trafficRows =
    organicLive && organicSeries && organicSeries.points.length > 0
      ? organicSeries.points.map((p) => ({
          label: shortDay(p.bucket),
          clicks: p.clicks,
          impressions: p.impressions,
        }))
      : [];

  const organicQueryRows: OrganicQueryRow[] =
    organicLive && organicQueries && organicQueries.length > 0
      ? organicQueries.map((q) => ({
          q: q.query,
          hint: `Position ${q.position.toFixed(1)} · ${fmtPercentRatio(q.ctr)} CTR`,
          clicks: fmtNumber(q.clicks),
        }))
      : [];

  // KPI + footer figures: live summary when connected, else em dashes.
  const organicKpis = organicLive
    ? {
        clicks: fmtNumber(organicSummary?.clicks),
        impressions: fmtNumber(organicSummary?.impressions),
        ctr: fmtPercentRatio(organicSummary?.ctr),
        position: (organicSummary?.avgPosition ?? 0).toFixed(1),
      }
    : { clicks: '—', impressions: '—', ctr: '—', position: '—' };

  const allAuditsBtn = (
    <Button
      variant="outline"
      iconStart={<Gauge className="h-4 w-4" />}
      render={<Link href="/seo/audits" />}
    >
      All audits
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
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
          <Card className="bg-module bg-soft">
            <CardBody className="p-0">
              <EmptyState
                icon={<Gauge className="h-5 w-5" />}
                title="No audits yet"
                description="Run a scan to score every page, product, and collection across your site — then this overview lights up with your health score, top fixes, and worst pages."
                actions={canScan ? <RescanButton size="md" /> : undefined}
              />
            </CardBody>
          </Card>
        ) : (
          <>
            {/* KPI strip — pages scored + issues live; organic live once Search
                Console is connected, else em dashes */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                hint={organicLive ? 'Clicks from search' : 'Connect Search Console'}
              />
              <Stat
                icon={<Target className="h-4 w-4" />}
                label="Avg. position"
                value={organicKpis.position}
                hint={organicLive ? 'Across ranked queries' : 'Connect Search Console'}
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Issues to fix"
                value={fmtNumber(issuesTotal)}
                hint={issuesTotal ? 'Pages with a top fix' : 'No outstanding fixes'}
              />
            </div>

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

            {/* SEO health (live score) + organic traffic (live once connected) */}
            <div className={TWO_COL_FLIP}>
              <OverviewCard
                title="SEO health"
                icon={<Zap className="h-4 w-4" />}
                plain
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
                  <span className="text-base-content/50 text-base font-normal"> / 100</span>
                </p>
                <p className="text-base-content/50 mt-1.5 mb-3 text-sm">
                  Average score across{' '}
                  <span className="text-base-content/70">{fmtNumber(count)}</span> scored page
                  {count === 1 ? '' : 's'}
                </p>
                {checklistRows.length ? (
                  checklistRows.map((c) => (
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
                  ))
                ) : (
                  <EmptyState
                    icon={<Zap className="h-5 w-5" />}
                    title="No checks yet"
                    description="The technical checklist fills in as pages are scored."
                  />
                )}
              </OverviewCard>

              <OverviewCard
                title="Organic traffic"
                icon={<TrendingUp className="h-4 w-4" />}
                plain
                description={organicLive ? 'Clicks from search · last 28 days' : undefined}
                right={
                  <SearchConsoleControl configured={gscConfigured} connection={gscConnection} />
                }
              >
                {trafficRows.length ? (
                  <>
                    <AreaChart
                      data={trafficRows}
                      series={[
                        { key: 'clicks', label: 'Clicks', color: 'module' },
                        {
                          key: 'impressions',
                          label: 'Impressions',
                          color: 'color-mix(in oklch, var(--color-module) 15%, transparent)',
                        },
                      ]}
                      xKey="label"
                      height={210}
                      valueFormat="number"
                      ariaLabel="Organic clicks and impressions"
                    />
                    <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                      {[
                        ['Clicks', organicKpis.clicks],
                        ['Impressions', organicKpis.impressions],
                        ['CTR', organicKpis.ctr],
                        ['Avg. position', organicKpis.position],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-base-content/50 text-xs">{label}</div>
                          <div className="font-medium">{value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="h-5 w-5" />}
                    title="No organic data yet"
                    description="Connect Google Search Console to see clicks, impressions, and rankings from search."
                  />
                )}
              </OverviewCard>
            </div>

            {/* Pages to fix — live, worst score first. This page's primary
                (tinted) card; every other card in this scope is `plain`. */}
            <OverviewCard
              title="Pages to fix"
              icon={<FileText className="h-4 w-4" />}
              description="Lowest-scoring pages first — start here"
              right={<CardLink href="/seo/audits">All pages</CardLink>}
            >
              {worst.length ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Type</th>
                      <th className="text-right">Score</th>
                      <th>Top fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worst.map((r) => {
                      const rb = healthBand(r.score);
                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="text-base-content font-medium">
                              {r.title ?? '(untitled)'}
                            </div>
                            {r.path && (
                              <div className="text-module font-mono text-xs">{r.path}</div>
                            )}
                          </td>
                          <td className="text-base-content/50">{ENTITY_LABEL[r.entityType]}</td>
                          <td className="text-right">
                            <Badge color={rb.color} variant="soft">
                              {r.score}
                            </Badge>
                          </td>
                          <td className="text-base-content/70">{r.fixFirst ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No pages to fix"
                  description="Scored pages appear here, lowest score first."
                />
              )}
            </OverviewCard>

            {/* Issues by type (live) + top queries + recent activity */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <OverviewCard
                title="Issues by type"
                icon={<AlertTriangle className="h-4 w-4" />}
                plain
                right={<CardLink href="/seo/audits">Audit</CardLink>}
              >
                {issues.length > 0 ? (
                  <BarList
                    items={issues.slice(0, 6).map((it) => ({ ...it }))}
                    color="module"
                    valueFormat="number"
                  />
                ) : (
                  <EmptyState
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="No outstanding issues"
                    description="Every scored page is clean."
                  />
                )}
              </OverviewCard>

              <OverviewCard title="Top queries" icon={<Search className="h-4 w-4" />} plain>
                {organicQueryRows.length ? (
                  organicQueryRows.map((q) => (
                    <OverviewRow
                      key={q.q}
                      icon={<Search className="h-4 w-4" />}
                      tone="module"
                      title={q.q}
                      hint={q.hint}
                      right={q.clicks}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="No queries yet"
                    description="Top search queries appear once Search Console is connected."
                  />
                )}
              </OverviewCard>

              <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
                {activityRows.length ? (
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
                    description="Audit runs will show up here as you scan."
                  />
                )}
              </OverviewCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
