import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Link2,
  Mail,
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

import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
} from '../_components/overview-bits';

// CMS overview — the editor's morning glance at how content on switchback.coffee
// is performing: publishing KPIs, the editorial action queue, the idea→published
// pipeline, what readers are reading, and what's queued next. CMS has no
// reporting endpoints yet, so EVERY metric here is illustrative and rendered
// behind a <SampleBadge>; swap to live /v1/cms/reports/* data when it lands.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// ── Sample data (illustrative — CMS reporting endpoints not built yet) ──

// Content views over the last 14 days (area chart series).
const SAMPLE_VIEWS_14D = [
  { label: 'Jun 1', views: 820 },
  { label: 'Jun 2', views: 760 },
  { label: 'Jun 3', views: 910 },
  { label: 'Jun 4', views: 1040 },
  { label: 'Jun 5', views: 980 },
  { label: 'Jun 6', views: 1180 },
  { label: 'Jun 7', views: 1120 },
  { label: 'Jun 8', views: 1290 },
  { label: 'Jun 9', views: 1210 },
  { label: 'Jun 10', views: 1380 },
  { label: 'Jun 11', views: 1460 },
  { label: 'Jun 12', views: 1340 },
  { label: 'Jun 13', views: 1520 },
  { label: 'Jun 14', views: 1610 },
] as const;

// Editorial pipeline — idea → published, descending.
const SAMPLE_PIPELINE = [
  { label: 'Ideas', value: 9 },
  { label: 'Draft', value: 5 },
  { label: 'In review', value: 4 },
  { label: 'Scheduled', value: 3 },
  { label: 'Published', value: 18 },
] as const;

// Views by content type (donut).
const SAMPLE_BY_TYPE = [
  { label: 'Blog', value: 48, color: 'module' as const },
  { label: 'Recipes', value: 22, color: 'var(--module-active-tint)' },
  { label: 'Brew guides', value: 18, color: '#99ddd5' },
  { label: 'Pages', value: 12, color: '#d6f5f0' },
];

// Top content by views.
const SAMPLE_TOP_CONTENT = [
  {
    title: 'How to dial in espresso at home',
    type: 'Brew guide',
    typeColor: 'module',
    views: '3,240',
    time: '3m 12s',
    signups: '41',
  },
  {
    title: 'Trailhead Blend tasting notes',
    type: 'Blog',
    typeColor: 'neutral',
    views: '2,610',
    time: '2m 04s',
    signups: '22',
  },
  {
    title: 'Cold brew in 3 steps',
    type: 'Recipe',
    typeColor: 'neutral',
    views: '2,180',
    time: '1m 48s',
    signups: '38',
  },
  {
    title: 'Meet our Ethiopian farm partners',
    type: 'Story',
    typeColor: 'neutral',
    views: '1,540',
    time: '2m 31s',
    signups: '12',
  },
  {
    title: 'Summer iced latte',
    type: 'Recipe',
    typeColor: 'neutral',
    views: '1,290',
    time: '1m 22s',
    signups: '9',
  },
] as const;

// Recent activity (timeline).
const SAMPLE_ACTIVITY = [
  { who: 'You', what: 'published', subject: 'How to dial in espresso', when: '1 day ago' },
  { who: 'Sam Ortiz', what: 'scheduled', subject: 'Colombia spotlight', when: '2 days ago' },
  { who: 'You', what: 'updated', subject: 'Trailhead tasting notes', when: '4 days ago' },
  { who: 'Sam Ortiz', what: 'added a Recipe draft', subject: '', when: '1 week ago' },
] as const;

export default async function CmsPage() {
  await requireSession();

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="CMS"
          description="Your content on switchback.coffee — last 30 days."
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

        {/* Headline KPIs */}
        <Stack gap={2}>
          <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
            <Stat
              icon={<FileText className="h-4 w-4" />}
              label="Published · 30d"
              value="18"
              hint="Posts & pages gone live"
            />
            <Stat
              icon={<Eye className="h-4 w-4" />}
              label="Content views · 30d"
              value="14,200"
              hint="Across all published content"
            />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="Avg. read time"
              value="2m 38s"
              hint="Scroll depth 71%"
            />
            <Stat
              icon={<Mail className="h-4 w-4" />}
              label="Signups from content · 30d"
              value="142"
              hint="Content → email"
            />
          </Grid>
          <div className="flex items-center gap-2">
            <SampleBadge />
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Illustrative until CMS reporting endpoints land
            </span>
          </div>
        </Stack>

        {/* Editorial action queue */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Pencil className="h-5 w-5" />}
            count={4}
            label="Drafts in review"
            tone="module"
          >
            <Link href="/cms/content?status=in_review" />
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
            icon={<AlertTriangle className="h-5 w-5" />}
            count={2}
            label="Scheduled posts at risk"
            tone="danger"
          >
            <Link href="/cms/content?status=scheduled" />
          </ActionTile>
        </ActionQueue>

        {/* Editorial pipeline */}
        <OverviewCard
          title="Editorial pipeline"
          icon={<Layers className="h-4 w-4" />}
          description="Where your content stands, idea to published"
          right={<SampleBadge />}
        >
          <BarList
            items={SAMPLE_PIPELINE.map((s) => ({ label: s.label, value: s.value }))}
            color="module"
            valueFormatter={(v) => fmtNumber(v)}
          />
        </OverviewCard>

        {/* Content views + by content type */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Content views"
            icon={<TrendingUp className="h-4 w-4" />}
            description="All published content · last 14 days"
            right={<SampleBadge />}
          >
            <AreaChart
              data={[...SAMPLE_VIEWS_14D]}
              series={[{ key: 'views', label: 'Views', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormatter={(v) => fmtNumber(v)}
              ariaLabel="Content views, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Unique readers', '9,120'],
                ['Avg. time', '2m 38s'],
                ['Top source', 'Search'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>

          <OverviewCard
            title="By content type"
            icon={<Layers className="h-4 w-4" />}
            right={<CardLink href="/cms/reports">Report</CardLink>}
          >
            <DonutChart
              data={SAMPLE_BY_TYPE}
              valueFormatter={(v) => `${v}%`}
              centerValue="48%"
              centerLabel="blog"
              ariaLabel="Views by content type"
            />
            <div className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Best performer ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">Brew guides</span> —
              3m 02s avg. read
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Top content + upcoming schedule */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Top content"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/cms/content">All content</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Avg. time</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_TOP_CONTENT.map((c) => (
                  <TableRow key={c.title}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      <Badge color={c.typeColor} variant="soft">
                        {c.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.views}</TableCell>
                    <TableCell className="text-right text-[var(--color-text-secondary)] tabular-nums">
                      {c.time}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.signups}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Upcoming schedule"
            icon={<Calendar className="h-4 w-4" />}
            right={<CardLink href="/cms/calendar">Calendar</CardLink>}
          >
            <OverviewRow
              icon={<Coffee className="h-4 w-4" />}
              tone="module"
              title="Single-origin spotlight: Colombia"
              hint="Jun 17 · 9:00am"
              right={
                <Badge color="success" variant="soft">
                  Scheduled
                </Badge>
              }
            />
            <OverviewRow
              icon={<ImageIcon className="h-4 w-4" />}
              tone="warning"
              title="Father's Day gift guide"
              hint="Jun 15"
              right={
                <Badge color="warning" variant="soft">
                  At risk · no image
                </Badge>
              }
            />
            <OverviewRow
              icon={<BookOpen className="h-4 w-4" />}
              tone="module"
              title="Brew guide: AeroPress"
              hint="Jun 20"
              right={
                <Badge color="neutral" variant="soft">
                  Draft
                </Badge>
              }
            />
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Content types + recent activity + SEO health */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Content types"
            icon={<Layers className="h-4 w-4" />}
            right={<CardLink href="/cms/content-types">Manage</CardLink>}
          >
            <div className="grid grid-cols-2 gap-3">
              <MetricTile value="64" label="Blog posts" />
              <MetricTile value="28" label="Recipes" />
              <MetricTile value="19" label="Brew guides" />
              <MetricTile value="14" label="Pages" />
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />}>
            <Timeline>
              {SAMPLE_ACTIVITY.map((a, i) => (
                <TimelineItem
                  key={`${a.who}-${a.subject}-${i}`}
                  showConnector={i < SAMPLE_ACTIVITY.length - 1}
                >
                  <TimelineTitle>
                    <span className="font-medium">{a.who}</span>{' '}
                    <span className="font-normal text-[var(--color-text-secondary)]">{a.what}</span>
                    {a.subject && (
                      <>
                        {' '}
                        <span className="font-medium">{a.subject}</span>
                      </>
                    )}
                  </TimelineTitle>
                  <TimelineTime>{a.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
            <div className="mt-3">
              <SampleBadge />
            </div>
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
