// /builder — the Builder overview/landing (docs/builder/06). It does two jobs in
// one page: a live-site overview (status hero, traffic, top pages, health,
// activity) AND the surface picker — "Start from a blueprint" plus the
// build-it-yourself surfaces grid, which now open the unified editor
// (/builder/studio) after the Phase-7 cutover (docs/builder/07).
//
// LIVE today (real `/v1` reads, fail-soft behind <SampleBadge/> via liveOr):
//   · Blueprint teaser — /v1/blueprints
//   · Pages & content — /v1/builder/pages (published vs draft) + /v1/builder/components
// SAMPLE (no endpoint yet — see docs/dashboard-overview-data-gaps.md §Site builder):
//   · the analytics cards (visitors / pageviews / traffic / top pages / sources /
//     signups) need a net-new per-site site-analytics surface; the status hero's
//     publish/uptime facts, site health, needs-attention scan, and the activity
//     feed need their own (modest) endpoints. All stay badged until wired.
//
// The builder layout is gate-only (no ModuleProvider, so the editor's full-height
// shell isn't disturbed), so this page supplies its own module color via
// <ModuleProvider module="builder">.

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Component,
  Eye,
  File,
  FileText,
  Fingerprint,
  Gauge,
  Globe,
  Image,
  LayoutTemplate,
  Link2,
  Lock,
  Mail,
  Palette,
  Pencil,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import {
  AreaChart,
  Badge,
  BarList,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Timeline,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  liveOr,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
} from '../_components/overview-bits';
import { listComponentsFull, listPages } from './_lib/api';

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// ── Sample data (illustrative until the matching endpoints land) ──
const SAMPLE_TRAFFIC_14D = [
  { label: 'May 31', visitors: 420, pageviews: 1180 },
  { label: 'Jun 1', visitors: 468, pageviews: 1290 },
  { label: 'Jun 2', visitors: 451, pageviews: 1240 },
  { label: 'Jun 3', visitors: 520, pageviews: 1460 },
  { label: 'Jun 4', visitors: 558, pageviews: 1580 },
  { label: 'Jun 5', visitors: 532, pageviews: 1490 },
  { label: 'Jun 6', visitors: 604, pageviews: 1710 },
  { label: 'Jun 7', visitors: 588, pageviews: 1650 },
  { label: 'Jun 8', visitors: 662, pageviews: 1880 },
  { label: 'Jun 9', visitors: 701, pageviews: 1990 },
  { label: 'Jun 10', visitors: 648, pageviews: 1840 },
  { label: 'Jun 11', visitors: 742, pageviews: 2110 },
  { label: 'Jun 12', visitors: 781, pageviews: 2230 },
  { label: 'Jun 13', visitors: 728, pageviews: 2070 },
] as const;

const SAMPLE_SOURCES = [
  { label: 'Search', value: 48, display: '48%' },
  { label: 'Direct', value: 26, display: '26%' },
  { label: 'Social', value: 18, display: '18%', color: 'var(--module-active-tint)' },
  { label: 'Referral', value: 8, display: '8%', color: 'var(--module-active-tint)' },
];

const SAMPLE_TOP_PAGES = [
  { page: 'Home', path: '/', views: '9,840', time: '1m 12s', conv: '4.1%' },
  { page: 'Shop', path: '/shop', views: '6,210', time: '2m 04s', conv: '6.8%' },
  { page: 'Subscriptions', path: '/subscriptions', views: '3,005', time: '2m 41s', conv: '9.2%' },
  { page: 'Our Story', path: '/about', views: '1,690', time: '0m 58s', conv: '2.0%' },
  { page: 'Wholesale', path: '/wholesale', views: '1,120', time: '1m 36s', conv: '7.4%' },
] as const;

const SAMPLE_ATTENTION = [
  {
    icon: <Search className="h-4 w-4" />,
    tone: 'warning',
    title: '2 pages missing meta descriptions',
    hint: 'Home · Wholesale — hurts search ranking',
    action: 'Fix',
  },
  {
    icon: <Link2 className="h-4 w-4" />,
    tone: 'warning',
    title: '2 broken links',
    hint: 'In the footer & the Cold Brew product page',
    action: 'Review',
  },
  {
    icon: <Image className="h-4 w-4" />,
    tone: 'warning',
    title: '5 images missing alt text',
    hint: 'Affects accessibility & image search',
    action: 'Fix',
  },
  {
    icon: <Globe className="h-4 w-4" />,
    tone: 'module',
    title: 'Connect a marketing pixel',
    hint: 'No analytics tag detected yet',
    action: 'Add',
  },
] as const;

const SAMPLE_HEALTH = [
  { icon: <Gauge className="h-4 w-4" />, tone: 'success', title: 'Performance', right: '94 / 100' },
  {
    icon: <Smartphone className="h-4 w-4" />,
    tone: 'success',
    title: 'Mobile-friendly',
    right: (
      <Badge color="success" variant="soft">
        Pass
      </Badge>
    ),
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    tone: 'success',
    title: 'SSL & HTTPS',
    right: (
      <Badge color="success" variant="soft">
        Active
      </Badge>
    ),
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    tone: 'success',
    title: 'Sitemap submitted',
    right: 'Jun 12',
  },
  {
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: 'warning',
    title: 'SEO metadata',
    right: '12 / 14',
  },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'You published the site', time: '2 days ago' },
  { title: 'Sam Ortiz edited Shop — added 3 products', time: '3 days ago' },
  { title: 'You changed the brand accent to Ember Orange', time: '5 days ago' },
  { title: 'You added a new page: Wholesale', time: '1 week ago' },
] as const;

// The build-it-yourself entry points. Brand / Site / Page open the unified editor
// at the matching zone (docs/builder/07 §2.1 — the three split routes redirect
// here); Email and Components keep their own surfaces.
const SURFACES = [
  {
    href: '/builder/studio?zone=theme',
    icon: Fingerprint,
    title: 'Brand',
    description: 'Your identity — colors, type, logo, and rounding the whole site renders in.',
  },
  {
    href: '/builder/studio?zone=layout',
    icon: Globe,
    title: 'Site',
    description: 'The site shell: header, footer, navigation, and page layouts.',
  },
  {
    href: '/builder/studio',
    icon: File,
    title: 'Page',
    description: 'Design page templates on the visual canvas, bound to your content and catalog.',
  },
  {
    href: '/builder/email',
    icon: Mail,
    title: 'Email',
    description: 'Build branded emails as composable node trees, ready to broadcast.',
  },
  {
    href: '/builder/components',
    icon: Component,
    title: 'Components',
    description: 'Reusable building blocks — primitives and your own saved components.',
  },
] as const;

// A faux browser-framed site preview built from divs. The browser CHROME (frame,
// dots, URL bar) rides Sparx neutral tokens so it stays theme-consistent; the
// PAGE CONTENT inside the frame is intentionally an off-palette warm "coffee"
// scheme — it represents the *tenant's own storefront brand*, not Sparx UI, so it
// reads as "your live site" rather than more dashboard chrome (same category as
// the product-thumbnail gradients on the commerce page). Decorative + aria-hidden.
function SitePreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-sm"
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2.5 py-2">
        <span className="h-2 w-2 rounded-full bg-[var(--color-bg-muted)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--color-bg-muted)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--color-bg-muted)]" />
        <span className="ml-2 flex-1 rounded bg-[var(--color-bg-surface)] px-2 py-0.5 font-mono text-[9px]">
          <span className="text-[var(--color-text-tertiary)]">switchback.coffee</span>
        </span>
      </div>
      {/* ── tenant storefront brand (intentional warm palette, not Sparx tokens) ── */}
      <div className="bg-[#fbf7f0] pb-2.5">
        <div className="flex items-center gap-1.5 border-b border-[#efe6d8] px-3 py-2">
          <span className="text-[10px] font-medium text-[#7c2d12]">SWITCHBACK</span>
          <span className="ml-auto h-1 w-5 rounded-sm bg-[#e6d8c4]" />
          <span className="h-1 w-5 rounded-sm bg-[#e6d8c4]" />
          <span className="h-1 w-5 rounded-sm bg-[#e6d8c4]" />
        </div>
        <div className="bg-gradient-to-br from-[#fdf6ea] to-[#f6e7cf] px-3 pt-3.5 pb-3">
          <div className="h-2 w-[70%] rounded-sm bg-[#b45309]" />
          <div className="mt-1.5 h-1.5 w-[88%] rounded-sm bg-[#d6b48a]" />
          <div className="mt-2.5 h-4 w-16 rounded bg-[#7c2d12]" />
        </div>
        <div className="flex gap-1.5 px-3 pt-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 rounded-md border border-[#efe6d8] bg-white p-1">
              <div className="h-6 rounded-sm bg-gradient-to-br from-[#e8d3b3] to-[#cda06a]" />
              <div className="mt-1.5 h-1 rounded-sm bg-[#e6d8c4]" />
              <div className="mt-1 h-1 w-3/5 rounded-sm bg-[#e6d8c4]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ATTENTION_TONE: Record<string, string> = { warning: 'warning', module: 'module' };
const HEALTH_TONE: Record<string, string> = { success: 'success', warning: 'warning' };

export default async function BuilderOverviewPage() {
  // Teaser the blueprint catalog in-context (count + a few names). Degrades to a
  // plain CTA if the catalog read fails — this is the one piece of LIVE data here.
  let teaser: { count: number; names: string[] } | null = null;
  try {
    const { data: blueprints, meta } = await api.getPaged<{ name: string }[]>('/v1/blueprints');
    const count = (meta?.total as number | undefined) ?? blueprints.length;
    teaser = { count, names: blueprints.slice(0, 4).map((b) => b.name) };
  } catch {
    teaser = null;
  }

  // Pages & content — real catalog counts (published vs draft pages + saved
  // components). Fail-soft to a badged example if either read errors. `published`
  // marks a page that has a live snapshot; the rest are pure drafts.
  let catalog: { published: number; drafts: number; components: number } | null = null;
  try {
    const [pages, components] = await Promise.all([listPages(), listComponentsFull()]);
    const published = pages.filter((p) => p.published).length;
    catalog = { published, drafts: pages.length - published, components: components.length };
  } catch {
    catalog = null;
  }
  const cat = liveOr(catalog, { published: 14, drafts: 3, components: 9 });

  return (
    <ModuleProvider module="builder">
      <Container size="xl">
        <Stack gap={6} className="py-8">
          <PageHeader
            icon={<Boxes className="h-5 w-5" />}
            title="Builder"
            description="Design and manage everything visitors see on switchback.coffee."
            actions={
              <>
                <Button asChild variant="outline" leftIcon={<Eye className="h-4 w-4" />}>
                  <Link href="/builder/studio?zone=layout">Preview</Link>
                </Button>
                <Button asChild color="module" leftIcon={<Pencil className="h-4 w-4" />}>
                  <Link href="/builder/studio">Open editor</Link>
                </Button>
              </>
            }
          />

          {/* Status hero — the live-site glance: preview, status, two side facts. */}
          <OverviewCard
            title="Your site"
            icon={<Globe className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr_auto] lg:items-center">
              <SitePreview />

              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-[var(--color-success-text)]"
                  />
                  Your site is live
                </p>
                <a
                  href="https://switchback.coffee"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--module-active-text)]"
                >
                  <Lock className="h-3.5 w-3.5 text-[var(--color-success-text)]" />
                  switchback.coffee
                </a>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  Custom domain · SSL active · Last published 2 days ago · 14 pages live
                </p>
                <OverviewRow
                  className="mt-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-warning-tint)] px-3"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="warning"
                  title="3 unpublished changes"
                  hint="On Home, Shop, and your theme — waiting to go live."
                  right={
                    <Button
                      asChild
                      color="module"
                      size="sm"
                      leftIcon={<Rocket className="h-4 w-4" />}
                    >
                      <Link href="/builder/studio">Review &amp; publish</Link>
                    </Button>
                  }
                />
              </div>

              <div className="flex flex-row gap-3 lg:min-w-[10rem] lg:flex-col">
                <MetricTile className="flex-1" value="99.98%" label="Uptime · 30d" />
                <MetricTile className="flex-1" value="94 / 100" label="Performance score" />
              </div>
            </div>
          </OverviewCard>

          {/* KPI strip — all illustrative. */}
          <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Visitors · 30d"
              value="8,420"
              hint="Unique visitors, last 30 days"
            />
            <Stat
              icon={<Eye className="h-4 w-4" />}
              label="Pageviews · 30d"
              value="23,180"
              hint="2.75 pages per visit"
            />
            <Stat
              icon={<Zap className="h-4 w-4" />}
              label="Avg. load time"
              value="0.9s"
              hint="LCP 1.2s · CLS 0.02"
            />
            <Stat
              icon={<Mail className="h-4 w-4" />}
              label="Email signups · 30d"
              value="312"
              hint="3.7% of visitors"
            />
          </Grid>
          <div className="-mt-2">
            <SampleBadge />
          </div>

          {/* Traffic + sources. */}
          <div className={TWO_COL}>
            <OverviewCard
              title="Traffic"
              icon={<TrendingUp className="h-4 w-4" />}
              description="Visitors & pageviews · last 14 days"
              right={<SampleBadge />}
            >
              <AreaChart
                data={SAMPLE_TRAFFIC_14D}
                series={[
                  { key: 'visitors', label: 'Visitors', color: 'module' },
                  { key: 'pageviews', label: 'Pageviews', color: 'var(--module-active-tint)' },
                ]}
                xKey="label"
                height={210}
                valueFormat="number"
                ariaLabel="Site traffic, last 14 days"
              />
            </OverviewCard>

            <OverviewCard
              title="Where visitors come from"
              icon={<Target className="h-4 w-4" />}
              right={<SampleBadge />}
            >
              <BarList items={SAMPLE_SOURCES} color="module" />
              <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                Top referrer ·{' '}
                <span className="font-medium text-[var(--color-text-secondary)]">
                  instagram.com
                </span>{' '}
                — 1,140 visits
              </p>
            </OverviewCard>
          </div>

          {/* Top pages + needs attention. */}
          <div className={TWO_COL_WIDE}>
            <OverviewCard
              title="Top pages"
              icon={<FileText className="h-4 w-4" />}
              right={<CardLink href="/builder/studio">All pages</CardLink>}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Avg. time</TableHead>
                    <TableHead className="text-right">Signup conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_TOP_PAGES.map((p) => (
                    <TableRow key={p.path}>
                      <TableCell>
                        <div className="font-medium text-[var(--color-text-primary)]">{p.page}</div>
                        <div className="font-mono text-xs text-[var(--module-active-text)]">
                          {p.path}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.time}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.conv}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3">
                <SampleBadge />
              </div>
            </OverviewCard>

            <OverviewCard
              title="Needs attention"
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Fix these to improve reach & quality"
              right={<SampleBadge />}
            >
              {SAMPLE_ATTENTION.map((a) => (
                <OverviewRow
                  key={a.title}
                  icon={a.icon}
                  tone={ATTENTION_TONE[a.tone]}
                  title={a.title}
                  hint={a.hint}
                  right={
                    <Badge color={a.tone === 'module' ? 'module' : 'warning'} variant="soft">
                      {a.action}
                    </Badge>
                  }
                />
              ))}
            </OverviewCard>
          </div>

          {/* Site health + pages & content + recent activity. */}
          <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
            <OverviewCard
              title="Site health"
              icon={<Zap className="h-4 w-4" />}
              right={
                <Badge color="success" variant="soft">
                  Good
                </Badge>
              }
            >
              {SAMPLE_HEALTH.map((h) => (
                <OverviewRow
                  key={h.title}
                  icon={h.icon}
                  tone={HEALTH_TONE[h.tone]}
                  title={h.title}
                  right={h.right}
                />
              ))}
              <div className="mt-3">
                <SampleBadge />
              </div>
            </OverviewCard>

            <OverviewCard
              title="Pages & content"
              icon={<FileText className="h-4 w-4" />}
              right={<CardLink href="/builder/studio">Manage</CardLink>}
            >
              <div className="mb-3 grid grid-cols-2 gap-3">
                <MetricTile value={String(cat.data.published)} label="Published" />
                <MetricTile value={String(cat.data.drafts)} label="Drafts" tone="warning" />
              </div>
              <OverviewRow
                icon={<Palette className="h-4 w-4" />}
                tone="module"
                title="Theme"
                hint="Your site's colors, type & rounding"
                right={<CardLink href="/builder/studio?zone=theme">Edit</CardLink>}
              />
              <OverviewRow
                icon={<Component className="h-4 w-4" />}
                tone="module"
                title="Components"
                hint={`${cat.data.components} saved`}
                right={<CardLink href="/builder/components">Open</CardLink>}
              />
              {cat.isSample ? (
                <div className="mt-3">
                  <SampleBadge />
                </div>
              ) : null}
            </OverviewCard>

            <OverviewCard
              title="Recent activity"
              icon={<Clock className="h-4 w-4" />}
              right={<SampleBadge />}
            >
              <Timeline>
                {SAMPLE_ACTIVITY.map((a, i) => (
                  <TimelineItem key={a.title} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
                    <TimelineTitle>{a.title}</TimelineTitle>
                    <TimelineTime>{a.time}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            </OverviewCard>
          </Grid>

          {/* Surface picker — preserved from the original Builder landing. The
              blueprint teaser below is the one LIVE read on this page. */}
          <Card variant="module">
            <CardHeader>
              <Stack direction="row" align="center" gap={2}>
                <LayoutTemplate className="h-5 w-5 text-[var(--module-active)]" />
                <CardTitle>Start from a blueprint</CardTitle>
              </Stack>
              <CardDescription>
                Install a fully themed starting point — site, pages, products, content, and emails —
                onto your site as drafts. Review, customize, then go live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                {teaser && teaser.count > 0 ? (
                  <Text size="sm" variant="muted">
                    {teaser.count} ready-made {teaser.count === 1 ? 'blueprint' : 'blueprints'} —{' '}
                    {teaser.names.join(', ')}
                    {teaser.count > teaser.names.length ? ', and more' : ''}.
                  </Text>
                ) : null}
                <div>
                  <Button color="module" asChild>
                    <Link href="/marketplace">
                      Browse the marketplace
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Stack>
            </CardContent>
          </Card>

          <Stack gap={3}>
            <Heading level={3}>Or build it yourself</Heading>
            <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
              {SURFACES.map(({ href, icon: Icon, title, description }) => (
                <Card key={href} variant="module">
                  <CardHeader>
                    <Stack direction="row" align="center" gap={2}>
                      <Icon className="h-4 w-4 text-[var(--module-active)]" />
                      <CardTitle>{title}</CardTitle>
                    </Stack>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button color="module" variant="outline" size="sm" asChild>
                      <Link href={href}>Open {title.toLowerCase()}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
