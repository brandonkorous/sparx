import Link from 'next/link';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Link2,
  Pencil,
  Plus,
  TrendingUp,
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
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
  liveOr,
} from '../_components/overview-bits';

// CMS overview — the editor's morning glance at how content is performing.
// Counts, publishing cadence, content-by-type, recently-published, upcoming
// schedule and recent activity are all LIVE from `/v1/content/reports/*` (live
// aggregates over content_entries). Top-content-by-views is LIVE too, joining
// first-party site-analytics pageviews to each published entry's resolved path
// (`/v1/content/reports/top-content`). Read-time, the editorial issue queue, and
// the SEO-crawl card still need their own capture, so they stay badged sample.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// Teal donut palette (CMS module color + tints) for the by-type split.
const TYPE_COLORS = ['module', 'var(--module-active-tint)', '#99ddd5', '#5eccc0', '#d6f5f0'];

const STATUS_VERB: Record<string, string> = {
  draft: 'saved a draft of',
  scheduled: 'scheduled',
  published: 'published',
  archived: 'archived',
};

interface CmsSummary {
  total: number;
  byStatus: { draft: number; scheduled: number; published: number; archived: number };
  byType: { typeKey: string; name: string; count: number; publishedCount: number }[];
  publishedLast30d: number;
  scheduledUpcoming: number;
}
interface CadencePoint {
  bucket: string;
  publishedCount: number;
}
interface CmsCadence {
  range: { from: string; to: string; grain: string };
  points: CadencePoint[];
  totals: { publishedCount: number };
}
interface RecentEntry {
  id: string;
  title: string;
  typeKey: string;
  typeName: string;
  slug: string | null;
  status: string;
  author: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}
interface CmsRecent {
  activity: RecentEntry[];
  published: RecentEntry[];
  upcoming: RecentEntry[];
}
interface TopContentItem {
  id: string;
  title: string;
  typeName: string;
  path: string;
  views: number;
  visitors: number;
}
interface TopContent {
  totalViews: number;
  contentPagesViewed: number;
  items: TopContentItem[];
}
// The normalized row the Top-content card renders (shared by live + sample).
interface TopContentRow {
  key: string;
  title: string;
  typeName: string;
  views: string;
  visitors: string;
}

// ── Sample fallbacks (shown badged only until the tenant has content) ──
const SAMPLE_CADENCE_14D: { label: string; published: number }[] = [
  { label: 'Jun 1', published: 1 },
  { label: 'Jun 2', published: 0 },
  { label: 'Jun 3', published: 2 },
  { label: 'Jun 4', published: 1 },
  { label: 'Jun 5', published: 0 },
  { label: 'Jun 6', published: 3 },
  { label: 'Jun 7', published: 1 },
  { label: 'Jun 8', published: 2 },
  { label: 'Jun 9', published: 0 },
  { label: 'Jun 10', published: 1 },
  { label: 'Jun 11', published: 2 },
  { label: 'Jun 12', published: 1 },
  { label: 'Jun 13', published: 0 },
  { label: 'Jun 14', published: 2 },
];

const SAMPLE_PIPELINE = [
  { label: 'Draft', value: 5 },
  { label: 'Scheduled', value: 3 },
  { label: 'Published', value: 18 },
  { label: 'Archived', value: 2 },
];

const SAMPLE_BY_TYPE = [
  { label: 'Blog', value: 48, color: 'module' },
  { label: 'Recipes', value: 22, color: 'var(--module-active-tint)' },
  { label: 'Brew guides', value: 18, color: '#99ddd5' },
  { label: 'Pages', value: 12, color: '#d6f5f0' },
];

const SAMPLE_TOP_CONTENT: TopContentRow[] = [
  {
    key: 't1',
    title: 'How to brew the perfect cup',
    typeName: 'Blog',
    views: '2,140',
    visitors: '1,780',
  },
  {
    key: 't2',
    title: 'Cold brew concentrate guide',
    typeName: 'Brew guide',
    views: '1,460',
    visitors: '1,205',
  },
  { key: 't3', title: 'Ethiopia single origin', typeName: 'Blog', views: '980', visitors: '845' },
  {
    key: 't4',
    title: 'Our subscription, explained',
    typeName: 'Page',
    views: '720',
    visitors: '640',
  },
  { key: 't5', title: 'Iced latte recipe', typeName: 'Recipe', views: '540', visitors: '470' },
];

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function scheduleLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export default async function CmsPage() {
  await requireSession();

  const cadenceTo = new Date();
  const cadenceFrom = new Date(cadenceTo.getTime() - 13 * 86_400_000);
  const cadenceQs = new URLSearchParams({
    grain: 'day',
    from: cadenceFrom.toISOString(),
    to: cadenceTo.toISOString(),
  });

  const [summary, cadence, recent, topContent] = await Promise.all([
    api.get<CmsSummary>('/v1/content/reports/summary').catch(() => null),
    api.get<CmsCadence>(`/v1/content/reports/cadence?${cadenceQs.toString()}`).catch(() => null),
    api.get<CmsRecent>('/v1/content/reports/recent?limit=6').catch(() => null),
    api.get<TopContent>('/v1/content/reports/top-content?limit=6').catch(() => null),
  ]);

  const hasContent = !!summary && summary.total > 0;

  // Publishing cadence chart (gated on real publishes in the window).
  const cadencePoints =
    cadence && cadence.totals.publishedCount > 0
      ? cadence.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          published: p.publishedCount,
        }))
      : null;
  const cadence14d = liveOr(cadencePoints, SAMPLE_CADENCE_14D);
  const busiest = cadence ? Math.max(0, ...cadence.points.map((p) => p.publishedCount)) : 0;

  // Editorial pipeline by status.
  const pipelineItems = hasContent
    ? [
        { label: 'Draft', value: summary.byStatus.draft },
        { label: 'Scheduled', value: summary.byStatus.scheduled },
        { label: 'Published', value: summary.byStatus.published },
        { label: 'Archived', value: summary.byStatus.archived },
      ]
    : null;
  const pipeline = liveOr(pipelineItems, SAMPLE_PIPELINE);

  // By-type donut.
  const typeData =
    hasContent && summary.byType.length > 0
      ? summary.byType.slice(0, 5).map((t, i) => ({
          label: t.name,
          value: t.count,
          color: TYPE_COLORS[i % TYPE_COLORS.length],
        }))
      : null;
  const byType = liveOr(typeData, SAMPLE_BY_TYPE);
  const topType = hasContent ? summary.byType[0] : undefined;

  // Top content by views — joins site-analytics pageviews to published entries
  // (live once the site captures traffic; badged sample until then).
  const topContentRows: TopContentRow[] | null =
    topContent && topContent.items.length > 0
      ? topContent.items.map((it) => ({
          key: it.id,
          title: it.title,
          typeName: it.typeName,
          views: fmtNumber(it.views),
          visitors: fmtNumber(it.visitors),
        }))
      : null;
  const topContentDisplay = liveOr<TopContentRow[]>(topContentRows, SAMPLE_TOP_CONTENT);
  const contentViewsTotal = topContent && topContent.totalViews > 0 ? topContent.totalViews : null;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="CMS"
          description="Your content — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Eye className="h-4 w-4" />}>
                <Link href="/cms/preview">Preview</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<ImageIcon className="h-4 w-4" />}>
                <Link href="/cms/media">Media library</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/cms/new">New post</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — live counts from the content catalog */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<FileText className="h-4 w-4" />}
            label="Published · 30d"
            value={summary ? fmtNumber(summary.publishedLast30d) : '—'}
            hint="Posts & pages gone live"
          />
          <Stat
            icon={<Pencil className="h-4 w-4" />}
            label="Drafts"
            value={summary ? fmtNumber(summary.byStatus.draft) : '—'}
            hint="Work in progress"
          />
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="Scheduled"
            value={summary ? fmtNumber(summary.scheduledUpcoming) : '—'}
            hint="Queued to publish"
          />
          <Stat
            icon={<Layers className="h-4 w-4" />}
            label="Total content"
            value={summary ? fmtNumber(summary.total) : '—'}
            hint="Entries across all types"
          />
        </Grid>

        {/* Editorial action queue — issue detection needs scanning (sample) */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Pencil className="h-5 w-5" />}
            count={summary?.byStatus.draft ?? 4}
            label="Drafts in progress"
            tone="module"
          >
            <Link href="/cms/content?status=draft" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<ImageIcon className="h-5 w-5" />}
            count={3}
            label="Posts missing image / meta"
            tone="warning"
          >
            <Link href="/cms/content?issue=missing_meta" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Clock className="h-5 w-5" />}
            count={6}
            label="Stale · not updated 6+ mo"
            tone="warning"
          >
            <Link href="/cms/content?sort=stale" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Calendar className="h-5 w-5" />}
            count={summary?.byStatus.scheduled ?? 2}
            label="Scheduled posts"
            tone="module"
          >
            <Link href="/cms/content?status=scheduled" />
          </ActionTile>
        </ActionQueue>

        {/* Editorial pipeline — live counts by status */}
        <OverviewCard
          title="Editorial pipeline"
          icon={<Layers className="h-4 w-4" />}
          description="Where your content stands, by status"
          right={pipeline.isSample ? <SampleBadge reason="no-data" /> : undefined}
        >
          <BarList items={pipeline.data} color="module" valueFormat="number" />
        </OverviewCard>

        {/* Publishing cadence + by content type */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Publishing cadence"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Entries published per day · last 14 days"
            right={cadence14d.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={cadence14d.data}
              series={[{ key: 'published', label: 'Published', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat="number"
              ariaLabel="Entries published per day, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Published · 14d', cadence ? fmtNumber(cadence.totals.publishedCount) : '—'],
                ['Busiest day', cadence ? `${fmtNumber(busiest)} posts` : '—'],
                ['Scheduled ahead', summary ? fmtNumber(summary.scheduledUpcoming) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>

          <OverviewCard
            title="Content by type"
            icon={<Layers className="h-4 w-4" />}
            right={byType.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <DonutChart
              data={byType.data}
              valueFormat="number"
              centerValue={summary ? fmtNumber(summary.total) : '—'}
              centerLabel="entries"
              ariaLabel="Entries by content type"
            />
            {topType ? (
              <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                Most content ·{' '}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  {topType.name}
                </span>{' '}
                — {fmtNumber(topType.count)} entries
              </div>
            ) : null}
          </OverviewCard>
        </div>

        {/* Recently published + upcoming schedule */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Recently published"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/cms/content">All content</CardLink>}
          >
            {recent && recent.published.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.published.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/cms/content/${c.id}`}
                          className="hover:text-[var(--module-active)] hover:underline"
                        >
                          {c.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge color="neutral" variant="soft">
                          {c.typeName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-[var(--color-text-secondary)] tabular-nums">
                        {shortDate(c.publishedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="Nothing published yet"
                description="Publish your first post to see it here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Upcoming schedule"
            icon={<Calendar className="h-4 w-4" />}
            right={<CardLink href="/cms/content?status=scheduled">All scheduled</CardLink>}
          >
            {recent && recent.upcoming.length > 0 ? (
              recent.upcoming.map((c) => (
                <OverviewRow
                  key={c.id}
                  icon={<FileText className="h-4 w-4" />}
                  tone="module"
                  title={c.title}
                  hint={`${c.typeName} · ${scheduleLabel(c.scheduledAt)}`}
                  right={
                    <Badge color="success" variant="soft">
                      Scheduled
                    </Badge>
                  }
                />
              ))
            ) : (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="Nothing scheduled"
                description="Schedule a post to line up your publishing calendar."
              />
            )}
          </OverviewCard>
        </div>

        {/* Top content by views — site-analytics pageviews joined to entries */}
        <OverviewCard
          title="Top content by views"
          icon={<TrendingUp className="h-4 w-4" />}
          description="Your most-viewed published content · last 30 days"
          right={
            topContentDisplay.isSample ? (
              <SampleBadge reason="no-data" />
            ) : contentViewsTotal != null ? (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {fmtNumber(contentViewsTotal)} total views
              </span>
            ) : undefined
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Visitors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topContentDisplay.data.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>
                    <Badge color="neutral" variant="soft">
                      {c.typeName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.views}</TableCell>
                  <TableCell className="text-right text-[var(--color-text-secondary)] tabular-nums">
                    {c.visitors}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </OverviewCard>

        {/* Content types + recent activity + SEO health */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Content types"
            icon={<Layers className="h-4 w-4" />}
            right={<CardLink href="/cms/content-types">Manage</CardLink>}
          >
            {hasContent && summary.byType.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {summary.byType.slice(0, 4).map((t) => (
                  <MetricTile key={t.typeKey} value={fmtNumber(t.count)} label={t.name} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No content types in use"
                description="Create an entry to populate your content types."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />}>
            {recent && recent.activity.length > 0 ? (
              <Timeline>
                {recent.activity.map((a, i) => (
                  <TimelineItem key={a.id} showConnector={i < recent.activity.length - 1}>
                    <TimelineTitle>
                      <span className="font-medium">{a.author ?? 'Someone'}</span>{' '}
                      <span className="font-normal text-[var(--color-text-secondary)]">
                        {STATUS_VERB[a.status] ?? 'updated'}
                      </span>{' '}
                      <span className="font-medium">{a.title}</span>
                    </TimelineTitle>
                    <TimelineTime>{timeAgo(a.updatedAt)}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No activity yet"
                description="Editorial changes will appear here."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="SEO health"
            icon={<Globe className="h-4 w-4" />}
            right={
              <Badge color="warning" variant="soft">
                Review
              </Badge>
            }
          >
            <OverviewRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
              title="Indexed pages"
              right="121 / 125"
            />
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="warning"
              title="Meta complete"
              right="118 / 125"
            />
            <OverviewRow
              icon={<Link2 className="h-4 w-4" />}
              tone="warning"
              title="Broken links"
              right="2"
            />
            <OverviewRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
              title="Sitemap submitted"
              right={<span className="text-[var(--color-text-tertiary)]">Jun 12</span>}
            />
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
