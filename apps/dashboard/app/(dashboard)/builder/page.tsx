// /builder — the Builder overview/landing (docs/builder/06). It does two jobs in
// one page: a live-site overview (status hero, traffic, top pages, health,
// activity) AND the surface picker — "Start from a blueprint" plus the
// build-it-yourself surfaces grid, which now open the unified editor
// (/builder/studio) after the Phase-7 cutover (docs/builder/07).
//
// LIVE today (real `/v1` reads, each fail-soft behind <SampleBadge/> / an em dash):
//   · Blueprint teaser — /v1/blueprints
//   · Pages & content + status hero (pages live · last published · unpublished
//     changes) — /v1/builder/pages + /v1/builder/layouts (the catalog timestamps)
//   · Domain & SSL — /v1/domains (the canonical/verified domain)
//   · Site health + Needs attention (SEO) — /v1/seo/audits?type=builder_page
//   · Recent activity — derived from the page/layout catalog timestamps
//   · Analytics cards — visitors / pageviews / signups KPIs, the traffic chart,
//     sources, top pages, and the "Avg. load time" web-vitals KPI — from
//     /v1/builder/analytics/* (first-party, cookieless capture via the storefront
//     beacon; per active site). Each falls back to a badged sample until the site
//     has traffic; "Avg. load time" shows real-user load/LCP/CLS once the beacon
//     captures timing.
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
import type { SeoAuditRow } from '@/components/seo/types';
import {
  CardLink,
  fmtNumber,
  liveOr,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
} from '../_components/overview-bits';
import { listComponentsFull, listLayouts, listPages } from './_lib/api';

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
// dots, URL bar) rides sparx neutral tokens so it stays theme-consistent; the
// PAGE CONTENT inside the frame is intentionally an off-palette warm "coffee"
// scheme — it represents the *tenant's own storefront brand*, not sparx UI, so it
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
      {/* ── tenant storefront brand (intentional warm palette, not sparx tokens) ── */}
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

// ── Live-data shapes + derivations ───────────────────────────────────────────
/** The fields the overview reads off `GET /v1/domains` (the full view has more). */
interface DomainView {
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
}

// A builder page is "healthy" at SEO ≥ this; below it lands in Needs attention.
const SEO_OK = 80;

interface CatalogEntry {
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

// A draft has unpublished changes when it was never published, or edited since the
// last snapshot (the storefront still serves the older published tree).
function hasUnpublishedChanges(e: CatalogEntry): boolean {
  if (!e.published || !e.publishedAt) return true;
  return e.updatedAt > e.publishedAt;
}

function derivePublishStatus(
  pages: CatalogEntry[] | null,
  layouts: CatalogEntry[] | null
): { live: boolean; pagesLive: number; unpublished: number; lastPublishedAt: string | null } {
  if (!pages) return { live: false, pagesLive: 0, unpublished: 0, lastPublishedAt: null };
  const all = [...pages, ...(layouts ?? [])];
  const published = all.map((e) => e.publishedAt).filter((x): x is string => Boolean(x));
  return {
    live: true,
    pagesLive: pages.filter((p) => p.published).length,
    unpublished: all.filter(hasUnpublishedChanges).length,
    lastPublishedAt: published.length ? published.sort().at(-1)! : null,
  };
}

interface ActivityEntry {
  title: string;
  at: string;
}
interface TimedEntity {
  name: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// The single most-recent action on an entity (created → edited → published).
function recentAction(name: string, e: TimedEntity): ActivityEntry {
  const events: ActivityEntry[] = [{ title: `Created ${name}`, at: e.createdAt }];
  if (e.updatedAt > e.createdAt) events.push({ title: `Edited ${name}`, at: e.updatedAt });
  if (e.publishedAt) events.push({ title: `Published ${name}`, at: e.publishedAt });
  return events.reduce((latest, ev) => (ev.at > latest.at ? ev : latest));
}

function deriveActivity(
  pages: TimedEntity[] | null,
  layouts: TimedEntity[] | null
): ActivityEntry[] | null {
  if (!pages && !layouts) return null;
  return [
    ...(pages ?? []).map((p) => recentAction(p.name, p)),
    ...(layouts ?? []).map((l) => recentAction(`the ${l.name} layout`, l)),
  ]
    .sort((a, b) => (a.at > b.at ? -1 : 1))
    .slice(0, 5);
}

// Relative "time ago" for a timestamp — this is a force-dynamic server component,
// so `Date` is evaluated per request.
function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

// ── Live site-analytics shapes (/v1/builder/analytics/*) ──
interface SiteAnalyticsSummary {
  visitors: number;
  pageviews: number;
  sessions: number;
  signups: number;
  pagesPerVisit: number;
  topReferrerHost: string | null;
  topReferrerVisits: number;
}
interface SiteAnalyticsTimeseries {
  points: { bucket: string; visitors: number; pageviews: number }[];
  totals: { visitors: number; pageviews: number };
}
interface SiteTopPage {
  path: string;
  views: number;
  visitors: number;
}
interface SiteSourceRow {
  source: string;
  visits: number;
}
interface SiteVitals {
  load: number | null; // avg ms
  lcp: number | null; // avg ms
  cls: number | null; // avg unitless
  samples: number;
}

// Source class → friendly label for the "where visitors come from" bars.
const SOURCE_LABEL: Record<string, string> = {
  search: 'Search',
  direct: 'Direct',
  social: 'Social',
  referral: 'Referral',
};

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

  // ── Live reads (all fail-soft; the page is force-dynamic + tenant/property-scoped) ──
  // The builder catalog + its SEO snapshots + the active property's domains are the
  // real signals behind this overview; analytics (visitors / pageviews / traffic)
  // has no endpoint yet, so those cards stay on the sample data above.
  const [
    pages,
    layouts,
    components,
    audits,
    domains,
    anSummary,
    anTimeseries,
    anTopPages,
    anSources,
    anVitals,
  ] = await Promise.all([
    listPages().catch(() => null),
    listLayouts().catch(() => null),
    listComponentsFull().catch(() => null),
    api.get<SeoAuditRow[]>('/v1/seo/audits?type=builder_page').catch(() => null),
    api.get<DomainView[]>('/v1/domains').catch(() => null),
    api.get<SiteAnalyticsSummary>('/v1/builder/analytics/summary').catch(() => null),
    api
      .get<SiteAnalyticsTimeseries>('/v1/builder/analytics/timeseries?grain=day')
      .catch(() => null),
    api.get<SiteTopPage[]>('/v1/builder/analytics/top-pages?limit=6').catch(() => null),
    api.get<SiteSourceRow[]>('/v1/builder/analytics/sources').catch(() => null),
    api.get<SiteVitals>('/v1/builder/analytics/vitals').catch(() => null),
  ]);

  // Site analytics — live once the active site has captured any pageview, else
  // the illustrative sample (visitors / pageviews / signups KPIs + the traffic
  // chart, sources, and top-pages cards).
  const anLive = anSummary != null && anSummary.pageviews > 0;
  const visitorsKpi = anLive ? fmtNumber(anSummary.visitors) : '8,420';
  const pageviewsKpi = anLive ? fmtNumber(anSummary.pageviews) : '23,180';
  const pageviewsHint = anLive
    ? `${anSummary.pagesPerVisit} pages per visit`
    : '2.75 pages per visit';
  const signupsKpi = anLive ? fmtNumber(anSummary.signups) : '312';

  // Real-user web vitals — live once the beacon has captured timing samples.
  const vitalsLive = anVitals != null && anVitals.samples > 0 && anVitals.load != null;
  const loadKpi = vitalsLive ? `${(anVitals.load! / 1000).toFixed(1)}s` : '0.9s';
  const loadHint = vitalsLive
    ? [
        anVitals.lcp != null ? `LCP ${(anVitals.lcp / 1000).toFixed(1)}s` : null,
        anVitals.cls != null ? `CLS ${anVitals.cls.toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Real-user timing'
    : 'LCP 1.2s · CLS 0.02';

  const trafficChart = liveOr(
    anTimeseries && anTimeseries.totals.pageviews > 0
      ? anTimeseries.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          visitors: p.visitors,
          pageviews: p.pageviews,
        }))
      : null,
    [...SAMPLE_TRAFFIC_14D]
  );

  const totalSourceVisits = (anSources ?? []).reduce((s, r) => s + r.visits, 0);
  const sourceBars = liveOr(
    anSources && totalSourceVisits > 0
      ? anSources.map((r) => ({
          label: SOURCE_LABEL[r.source] ?? r.source,
          value: Math.round((r.visits / totalSourceVisits) * 100),
          display: `${Math.round((r.visits / totalSourceVisits) * 100)}%`,
        }))
      : null,
    SAMPLE_SOURCES
  );

  const topPagesLive = liveOr(
    anTopPages && anTopPages.length > 0
      ? anTopPages.map((p) => ({
          page: p.path === '/' ? 'Home' : p.path.replace(/^\//, ''),
          path: p.path,
          views: fmtNumber(p.views),
          visitors: fmtNumber(p.visitors),
        }))
      : null,
    SAMPLE_TOP_PAGES.map((p) => ({
      page: p.page,
      path: p.path,
      views: p.views,
      // ~72% of views as unique visitors — illustrative only.
      visitors: Math.round(Number.parseInt(p.views.replace(/,/g, ''), 10) * 0.72).toLocaleString(
        'en-US'
      ),
    }))
  );

  // Pages & content — published vs pure-draft pages + saved components.
  const catalog =
    pages && components
      ? {
          published: pages.filter((p) => p.published).length,
          drafts: pages.filter((p) => !p.published).length,
          components: components.length,
        }
      : null;
  const cat = liveOr(catalog, { published: 14, drafts: 3, components: 9 });

  // Status hero — a draft is "unpublished" when it was never published OR edited
  // since its last snapshot; `lastPublishedAt` is the newest snapshot across the
  // page + layout catalog; the live domain is the canonical (else verified) one.
  const status = derivePublishStatus(pages, layouts);
  const siteDomain =
    domains?.find((d) => d.isCanonical) ??
    domains?.find((d) => d.status === 'active' || d.status === 'verified') ??
    domains?.[0] ??
    null;
  const sslActive = siteDomain
    ? siteDomain.status === 'active' || siteDomain.status === 'verified'
    : false;

  // SEO health — from the stored builder-page audits (worst-scoring first).
  const seoCount = audits?.length ?? 0;
  const seoHealthy = audits?.filter((a) => a.score >= SEO_OK).length ?? 0;
  const seoAvg =
    audits && seoCount ? Math.round(audits.reduce((s, a) => s + a.score, 0) / seoCount) : null;
  const seoAttention = audits
    ? [...audits]
        .sort((a, b) => a.score - b.score)
        .filter((a) => a.score < SEO_OK)
        .slice(0, 4)
        .map((a) => ({
          id: a.id,
          title: a.fixFirst ?? `Improve “${a.title ?? a.path ?? 'a page'}”`,
          hint: `${a.title ?? a.path ?? 'Page'} · scores ${a.score}/100`,
        }))
    : null;

  // Recent activity — derived from catalog timestamps (the most recent action per
  // page/layout). Real "what + when" without an audit-feed endpoint.
  const activity = deriveActivity(pages, layouts);

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

          {/* Status hero — the live-site glance: domain/SSL + real publish state. */}
          <OverviewCard
            title="Your site"
            icon={<Globe className="h-4 w-4" />}
            right={status.live ? undefined : <SampleBadge />}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr_auto] lg:items-center">
              <SitePreview />

              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-medium text-[var(--color-text-primary)]">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      status.pagesLive > 0
                        ? 'bg-[var(--color-success-text)]'
                        : 'bg-[var(--color-bg-muted)]'
                    }`}
                  />
                  {status.pagesLive > 0 ? 'Your site is live' : 'Your site isn’t published yet'}
                </p>
                {siteDomain ? (
                  <a
                    href={`https://${siteDomain.host}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--module-active-text)]"
                  >
                    <Lock
                      className={`h-3.5 w-3.5 ${
                        sslActive
                          ? 'text-[var(--color-success-text)]'
                          : 'text-[var(--color-text-tertiary)]'
                      }`}
                    />
                    {siteDomain.host}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                    No domain connected yet
                  </p>
                )}
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  {siteDomain
                    ? `${siteDomain.type === 'custom' ? 'Custom domain' : 'sparx domain'} · ${
                        sslActive ? 'SSL active' : 'SSL pending'
                      } · `
                    : ''}
                  Last published {timeAgo(status.lastPublishedAt)} ·{' '}
                  {status.live ? status.pagesLive : '—'} pages live
                </p>
                {status.unpublished > 0 ? (
                  <OverviewRow
                    className="mt-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-warning-tint)] px-3"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    tone="warning"
                    title={`${status.unpublished} unpublished change${
                      status.unpublished === 1 ? '' : 's'
                    }`}
                    hint="Across your pages and layouts — waiting to go live."
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
                ) : null}
              </div>

              <div className="flex flex-row gap-3 lg:min-w-[10rem] lg:flex-col">
                <MetricTile
                  className="flex-1"
                  value={components ? String(components.length) : '—'}
                  label="Components"
                />
                <MetricTile
                  className="flex-1"
                  value={seoAvg != null ? `${seoAvg} / 100` : '—'}
                  label="SEO score"
                />
              </div>
            </div>
          </OverviewCard>

          {/* KPI strip — all illustrative. */}
          <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Visitors · 30d"
              value={visitorsKpi}
              hint="Unique visitors, last 30 days"
            />
            <Stat
              icon={<Eye className="h-4 w-4" />}
              label="Pageviews · 30d"
              value={pageviewsKpi}
              hint={pageviewsHint}
            />
            <Stat
              icon={<Zap className="h-4 w-4" />}
              label="Avg. load time"
              value={loadKpi}
              hint={loadHint}
            />
            <Stat
              icon={<Mail className="h-4 w-4" />}
              label="Email signups · 30d"
              value={signupsKpi}
              hint="Storefront newsletter signups"
            />
          </Grid>
          {!anLive ? (
            <div className="-mt-2">
              <SampleBadge />
            </div>
          ) : null}

          {/* Traffic + sources. */}
          <div className={TWO_COL}>
            <OverviewCard
              title="Traffic"
              icon={<TrendingUp className="h-4 w-4" />}
              description="Visitors & pageviews · last 14 days"
              right={trafficChart.isSample ? <SampleBadge reason="no-data" /> : undefined}
            >
              <AreaChart
                data={trafficChart.data}
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
              right={sourceBars.isSample ? <SampleBadge reason="no-data" /> : undefined}
            >
              <BarList items={sourceBars.data} color="module" />
              {anLive && anSummary.topReferrerHost ? (
                <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                  Top referrer ·{' '}
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {anSummary.topReferrerHost}
                  </span>{' '}
                  — {fmtNumber(anSummary.topReferrerVisits)} visits
                </p>
              ) : !anLive ? (
                <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                  Top referrer ·{' '}
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    instagram.com
                  </span>{' '}
                  — 1,140 visits
                </p>
              ) : null}
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
                    <TableHead className="text-right">Visitors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPagesLive.data.map((p) => (
                    <TableRow key={p.path}>
                      <TableCell>
                        <div className="font-medium text-[var(--color-text-primary)]">{p.page}</div>
                        <div className="font-mono text-xs text-[var(--module-active-text)]">
                          {p.path}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.views}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.visitors}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {topPagesLive.isSample ? (
                <div className="mt-3">
                  <SampleBadge reason="no-data" />
                </div>
              ) : null}
            </OverviewCard>

            <OverviewCard
              title="Needs attention"
              icon={<AlertTriangle className="h-4 w-4" />}
              description={
                seoAttention
                  ? 'SEO issues from your latest page audits'
                  : 'Fix these to improve reach & quality'
              }
              right={seoAttention ? <CardLink href="/seo">SEO report</CardLink> : <SampleBadge />}
            >
              {seoAttention === null ? (
                SAMPLE_ATTENTION.map((a) => (
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
                ))
              ) : seoAttention.length === 0 ? (
                <OverviewRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  tone="success"
                  title="No SEO issues to fix"
                  hint="Every audited page scores well — nice work."
                />
              ) : (
                seoAttention.map((a) => (
                  <OverviewRow
                    key={a.id}
                    icon={<Search className="h-4 w-4" />}
                    tone="warning"
                    title={a.title}
                    hint={a.hint}
                    right={
                      <Badge color="warning" variant="soft">
                        Fix
                      </Badge>
                    }
                  />
                ))
              )}
            </OverviewCard>
          </div>

          {/* Site health + pages & content + recent activity. */}
          <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
            <OverviewCard
              title="Site health"
              icon={<Zap className="h-4 w-4" />}
              right={
                audits || domains ? (
                  <Badge
                    color={
                      (!siteDomain || sslActive) && (seoCount === 0 || seoHealthy === seoCount)
                        ? 'success'
                        : 'warning'
                    }
                    variant="soft"
                  >
                    {(!siteDomain || sslActive) && (seoCount === 0 || seoHealthy === seoCount)
                      ? 'Good'
                      : 'Review'}
                  </Badge>
                ) : (
                  <Badge color="success" variant="soft">
                    Good
                  </Badge>
                )
              }
            >
              {audits || domains ? (
                <>
                  {domains ? (
                    <OverviewRow
                      icon={<ShieldCheck className="h-4 w-4" />}
                      tone={sslActive ? 'success' : 'warning'}
                      title="SSL & HTTPS"
                      right={
                        <Badge color={sslActive ? 'success' : 'warning'} variant="soft">
                          {sslActive ? 'Active' : siteDomain ? 'Pending' : 'No domain'}
                        </Badge>
                      }
                    />
                  ) : null}
                  {audits ? (
                    <OverviewRow
                      icon={<Search className="h-4 w-4" />}
                      tone={seoCount > 0 && seoHealthy === seoCount ? 'success' : 'warning'}
                      title="SEO metadata"
                      right={`${seoHealthy} / ${seoCount} pages`}
                    />
                  ) : null}
                  {seoAvg != null ? (
                    <OverviewRow
                      icon={<Gauge className="h-4 w-4" />}
                      tone={seoAvg >= SEO_OK ? 'success' : 'warning'}
                      title="Avg. SEO score"
                      right={`${seoAvg} / 100`}
                    />
                  ) : null}
                </>
              ) : (
                <>
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
                </>
              )}
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
              right={activity ? undefined : <SampleBadge />}
            >
              {activity && activity.length > 0 ? (
                <Timeline>
                  {activity.map((a, i) => (
                    <TimelineItem
                      key={`${a.title}-${a.at}`}
                      showConnector={i < activity.length - 1}
                    >
                      <TimelineTitle>{a.title}</TimelineTitle>
                      <TimelineTime>{timeAgo(a.at)}</TimelineTime>
                    </TimelineItem>
                  ))}
                </Timeline>
              ) : activity ? (
                <Text size="sm" variant="muted">
                  No activity yet — your edits and publishes will show up here.
                </Text>
              ) : (
                <Timeline>
                  {SAMPLE_ACTIVITY.map((a, i) => (
                    <TimelineItem key={a.title} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
                      <TimelineTitle>{a.title}</TimelineTitle>
                      <TimelineTime>{a.time}</TimelineTime>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
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
