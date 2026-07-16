import Link from 'next/link';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  TrendingUp,
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
} from '../_components/overview-bits';

// CMS overview — the editor's morning glance at how content is performing.
// Counts, publishing cadence, content-by-type, recently-published, upcoming
// schedule and recent activity are all LIVE from `/v1/content/reports/*` (live
// aggregates over content_entries). Top-content-by-views is LIVE too, joining
// first-party site-analytics pageviews to each published entry's resolved path
// (`/v1/content/reports/top-content`). A section with no data yet renders a
// compact empty state rather than illustrative sample data.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// Teal donut palette (CMS module color + tints) for the by-type split.
const TYPE_COLORS = [
  'module',
  'color-mix(in oklch, var(--color-module) 15%, transparent)',
  '#99ddd5',
  '#5eccc0',
  '#d6f5f0',
];

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
  const busiest = cadence ? Math.max(0, ...cadence.points.map((p) => p.publishedCount)) : 0;

  // Editorial pipeline by status — live counts (any content means ≥1 bar).
  const pipelineItems = hasContent
    ? [
        { label: 'Draft', value: summary.byStatus.draft },
        { label: 'Scheduled', value: summary.byStatus.scheduled },
        { label: 'Published', value: summary.byStatus.published },
        { label: 'Archived', value: summary.byStatus.archived },
      ]
    : null;

  // By-type donut.
  const typeData =
    hasContent && summary.byType.length > 0
      ? summary.byType.slice(0, 5).map((t, i) => ({
          label: t.name,
          value: t.count,
          color: TYPE_COLORS[i % TYPE_COLORS.length],
        }))
      : null;
  const topType = hasContent ? summary.byType[0] : undefined;

  // Top content by views — joins site-analytics pageviews to published entries.
  const topContentRows =
    topContent && topContent.items.length > 0
      ? topContent.items.map((it) => ({
          key: it.id,
          title: it.title,
          typeName: it.typeName,
          views: fmtNumber(it.views),
          visitors: fmtNumber(it.visitors),
        }))
      : null;
  const contentViewsTotal = topContent && topContent.totalViews > 0 ? topContent.totalViews : null;

  // Editorial action queue — only the two tiles with a real source survive.
  const draftCount = summary?.byStatus.draft ?? 0;
  const scheduledCount = summary?.byStatus.scheduled ?? 0;
  const showActionQueue = !!summary;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="CMS"
          description="Your content — last 30 days."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<Eye className="h-4 w-4" />}
                render={<Link href="/cms/preview" />}
              >
                Preview
              </Button>
              <Button
                variant="outline"
                iconStart={<ImageIcon className="h-4 w-4" />}
                render={<Link href="/cms/media" />}
              >
                Media library
              </Button>
              <Button
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
                render={<Link href="/cms/new" />}
              >
                New post
              </Button>
            </>
          }
        />

        {/* Headline KPIs — live counts from the content catalog */}
        <Stats className="w-full flex-wrap [&>*]:flex-1">
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <FileText className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Published · 30d</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.publishedLast30d) : '—'}</StatValue>
            <StatDesc>Posts & pages gone live</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Pencil className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Drafts</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.byStatus.draft) : '—'}</StatValue>
            <StatDesc>Work in progress</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Calendar className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Scheduled</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.scheduledUpcoming) : '—'}</StatValue>
            <StatDesc>Queued to publish</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Layers className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Total content</StatTitle>
            <StatValue>{summary ? fmtNumber(summary.total) : '—'}</StatValue>
            <StatDesc>Entries across all types</StatDesc>
          </Stat>
        </Stats>

        {/* Needs attention — both tiles wired to live status counts */}
        {showActionQueue && (
          <ActionQueue
            title="Needs attention"
            icon={<AlertTriangle className="h-4 w-4" />}
            columns={2}
          >
            <ActionTile
              asChild
              icon={<Pencil className="h-5 w-5" />}
              count={fmtNumber(draftCount)}
              label="Drafts in progress"
              tone="module"
            >
              <Link href="/cms/content?status=draft" />
            </ActionTile>
            <ActionTile
              asChild
              icon={<Calendar className="h-5 w-5" />}
              count={fmtNumber(scheduledCount)}
              label="Scheduled posts"
              tone="module"
            >
              <Link href="/cms/content?status=scheduled" />
            </ActionTile>
          </ActionQueue>
        )}

        {/* Editorial pipeline — the CMS overview's primary (tinted) card. */}
        <OverviewCard
          title="Editorial pipeline"
          icon={<Layers className="h-4 w-4" />}
          description="Where your content stands, by status"
        >
          {pipelineItems ? (
            <BarList items={pipelineItems} color="module" valueFormat="number" />
          ) : (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No content yet"
              description="Your editorial pipeline fills in as you create content."
              actions={
                <Button variant="outline" size="sm" render={<Link href="/cms/new" />}>
                  New post
                </Button>
              }
            />
          )}
        </OverviewCard>

        {/* Publishing cadence + by content type */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Publishing cadence"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Entries published per day · last 14 days"
            plain
          >
            {cadencePoints ? (
              <>
                <AreaChart
                  data={cadencePoints}
                  series={[{ key: 'published', label: 'Published', color: 'module' }]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="Entries published per day, last 14 days"
                />
                <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  {[
                    ['Published · 14d', cadence ? fmtNumber(cadence.totals.publishedCount) : '—'],
                    ['Busiest day', cadence ? `${fmtNumber(busiest)} posts` : '—'],
                    ['Scheduled ahead', summary ? fmtNumber(summary.scheduledUpcoming) : '—'],
                  ].map(([label, value]) => (
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
                title="No publishing activity yet"
                description="Publish entries to see your cadence over time."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Content by type" icon={<Layers className="h-4 w-4" />} plain>
            {typeData ? (
              <>
                <DonutChart
                  data={typeData}
                  valueFormat="number"
                  centerValue={summary ? fmtNumber(summary.total) : '—'}
                  centerLabel="entries"
                  ariaLabel="Entries by content type"
                />
                {topType ? (
                  <div className="border-base-300 text-base-content mt-4 border-t pt-3 text-xs">
                    Most content ·{' '}
                    <span className="text-base-content font-medium">{topType.name}</span> —{' '}
                    {fmtNumber(topType.count)} entries
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No content by type yet"
                description="The type split appears once you create entries."
              />
            )}
          </OverviewCard>
        </div>

        {/* Recently published + upcoming schedule */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Recently published"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/cms/content">All content</CardLink>}
            plain
          >
            {recent && recent.published.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th className="text-right">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.published.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">
                        <Link
                          href={`/cms/content/${c.id}`}
                          className="hover:text-module hover:underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td>
                        <Badge color="neutral" variant="soft">
                          {c.typeName}
                        </Badge>
                      </td>
                      <td className="text-base-content text-right tabular-nums">
                        {shortDate(c.publishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
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
            plain
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
            contentViewsTotal != null ? (
              <span className="text-base-content text-xs">
                {fmtNumber(contentViewsTotal)} total views
              </span>
            ) : undefined
          }
          plain
        >
          {topContentRows ? (
            <Table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {topContentRows.map((c) => (
                  <tr key={c.key}>
                    <td className="font-medium">{c.title}</td>
                    <td>
                      <Badge color="neutral" variant="soft">
                        {c.typeName}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">{c.views}</td>
                    <td className="text-base-content text-right tabular-nums">{c.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No views yet"
              description="Once your site captures traffic, top content ranks here."
            />
          )}
        </OverviewCard>

        {/* Content types + recent activity + SEO health */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <OverviewCard
            title="Content types"
            icon={<Layers className="h-4 w-4" />}
            right={<CardLink href="/cms/content-types">Manage</CardLink>}
            plain
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

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            {recent && recent.activity.length > 0 ? (
              <Timeline>
                {recent.activity.map((a, i) => (
                  <TimelineItem key={a.id} showConnector={i < recent.activity.length - 1}>
                    <TimelineTitle>
                      <span className="font-medium">{a.author ?? 'Someone'}</span>{' '}
                      <span className="text-base-content font-normal">
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

          <OverviewCard title="SEO health" icon={<Globe className="h-4 w-4" />} plain>
            <EmptyState
              icon={<Globe className="h-5 w-5" />}
              title="No SEO data yet"
              description="Indexing and meta coverage appear once your site is crawled."
            />
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
