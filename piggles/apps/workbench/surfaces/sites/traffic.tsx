'use client';

// How busy a site has been.
//
// The figures are sparx's OWN — a cookieless first-party beacon on every tenant
// site writes to `site_analytics_events`, and a nightly job rolls it up. Nothing
// here comes from Cloudflare: tenant domains are deliberately DNS-only (Caddy
// terminates TLS itself for on-demand certificates), so Cloudflare never sees a
// request to a tenant site and has no traffic data to give.
//
// Reads `?property=<id>` rather than relying on the active-site header, because
// this panel shows ONE NAMED site's figures and you may well be working in a
// different one. Attributing another site's numbers to this name would be worse
// than showing nothing.

import { useQuery } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import {
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Text,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { api } from '../../lib/api/client';

interface SiteSummary {
  visitors: number;
  pageviews: number;
  sessions: number;
  signups: number;
  pagesPerVisit: number;
  topReferrerHost: string | null;
  topReferrerVisits: number;
}

interface SitePoint {
  bucket: string;
  visitors: number;
  pageviews: number;
}

interface SiteTimeseries {
  range: { from: string; to: string; grain: string };
  points: SitePoint[];
  totals: { visitors: number; pageviews: number };
}

/** The window every figure on this panel covers. Four weeks is long enough to
 *  survive a quiet weekend and short enough to still describe "now". Exported so
 *  the heading above the panel states the same number the figures use. */
export const TRAFFIC_WINDOW_DAYS = 28;

function useTrafficSummary(propertyId: string) {
  return useQuery({
    queryKey: ['site-traffic', 'summary', propertyId],
    queryFn: () => api.get<SiteSummary>(`/v1/builder/analytics/summary?property=${propertyId}`),
    // A failure here is a panel that does not render, never a broken page, so it
    // is not worth hammering the endpoint over.
    retry: false,
  });
}

function useTrafficSeries(propertyId: string) {
  return useQuery({
    queryKey: ['site-traffic', 'series', propertyId],
    queryFn: () =>
      api.get<SiteTimeseries>(`/v1/builder/analytics/timeseries?property=${propertyId}&grain=day`),
    retry: false,
  });
}

function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}

const NUMBER = new Intl.NumberFormat();

/**
 * Bar heights as twenty literal classes rather than an inline `style`.
 *
 * A percentage height is a continuous value, which normally means `style={{...}}`
 * — banned here, and rightly: it is the crack through which hand-painted
 * controls get in. Quantising to 5% steps makes the set finite, so every class
 * is a real string in the source that Tailwind can see and emit. On a 64px-tall
 * strip a 5% step is three pixels, which is below the threshold of noticing.
 */
const BAR_HEIGHT = [
  'h-px',
  'h-[5%]',
  'h-[10%]',
  'h-[15%]',
  'h-[20%]',
  'h-[25%]',
  'h-[30%]',
  'h-[35%]',
  'h-[40%]',
  'h-[45%]',
  'h-[50%]',
  'h-[55%]',
  'h-[60%]',
  'h-[65%]',
  'h-[70%]',
  'h-[75%]',
  'h-[80%]',
  'h-[85%]',
  'h-[90%]',
  'h-[95%]',
  'h-full',
];

/**
 * Daily visitors as a bar strip.
 *
 * Built from layout utilities rather than a charting library: one series, no
 * axes, no legend, no interaction beyond a tooltip. Pulling in a charting
 * dependency to draw thirty rectangles would be the tail wagging the dog.
 * Heights are relative to the busiest day in the window, so the shape is a
 * comparison within that window and never pretends to an absolute scale.
 */
function TrafficBars({ points }: { points: SitePoint[] }) {
  const peak = Math.max(1, ...points.map((point) => point.visitors));

  return (
    <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Daily visitors">
      {points.map((point) => {
        const label = new Date(point.bucket).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        });
        // A zero day still gets a hairline (index 0 is `h-px`): a GAP in the
        // strip reads as "no data recorded", which is a different claim from
        // "nobody came", and only one of them is true here.
        const step = point.visitors === 0 ? 0 : Math.round((point.visitors / peak) * 20);
        return (
          <Tooltip
            key={point.bucket}
            // The 600ms default is tuned for a button you might merely pass
            // over; these bars exist to be scrubbed along, and a six-tenths
            // pause per day makes reading the month feel broken.
            delay={100}
            content={`${label} · ${NUMBER.format(point.visitors)} ${
              point.visitors === 1 ? 'visitor' : 'visitors'
            }`}
          >
            <div className={`bg-module flex-1 rounded-sm ${BAR_HEIGHT[step] ?? 'h-px'}`} />
          </Tooltip>
        );
      })}
    </div>
  );
}

export function SiteTraffic({ propertyId }: { propertyId: string }) {
  const summary = useTrafficSummary(propertyId);
  const series = useTrafficSeries(propertyId);

  // The site builder owns site analytics, so a tenant without it has no figures
  // to show. Saying which module would light this up beats an empty card.
  if (isModuleDisabled(summary.error)) {
    return (
      <Text className="text-sm">
        Visitor figures come with the site builder, which is not switched on for this account.
      </Text>
    );
  }

  if (summary.isError) {
    return (
      <Text className="text-sm">
        Could not load visitor figures just now. The site itself is unaffected.
      </Text>
    );
  }

  if (summary.isPending || !summary.data) {
    return (
      <Text className="text-sm" role="status">
        Loading…
      </Text>
    );
  }

  const data = summary.data;
  const points = series.data?.points ?? [];
  const hasAnything = data.pageviews > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasAnything ? (
        <>
          <Stats className="w-full">
            <Stat>
              <StatTitle>Visitors</StatTitle>
              <StatValue>{NUMBER.format(data.visitors)}</StatValue>
              <StatDesc>people, counted once each</StatDesc>
            </Stat>
            <Stat>
              <StatTitle>Page views</StatTitle>
              <StatValue>{NUMBER.format(data.pageviews)}</StatValue>
              <StatDesc>{data.pagesPerVisit} pages per visit</StatDesc>
            </Stat>
            <Stat>
              <StatTitle>Visits</StatTitle>
              <StatValue>{NUMBER.format(data.sessions)}</StatValue>
              <StatDesc>separate trips to the site</StatDesc>
            </Stat>
          </Stats>

          {points.length > 0 ? (
            <div className="flex flex-col gap-1">
              <TrafficBars points={points} />
              {/* The strip carries an aria-label for screen readers, which left
                  sighted readers with an unlabelled row of rectangles. Says what
                  a bar IS, since nothing else on screen does. */}
              <Text className="text-sm">
                One bar per day, tallest being the busiest. Hover a bar for its date and count.
              </Text>
            </div>
          ) : null}

          {data.topReferrerHost ? (
            <Text className="text-sm">
              Most visitors arriving from another website came from{' '}
              <span className="font-medium">{data.topReferrerHost}</span> (
              {NUMBER.format(data.topReferrerVisits)}).
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="text-sm">
          No visits recorded in the last {TRAFFIC_WINDOW_DAYS} days. Figures start appearing as soon
          as people begin arriving — there is nothing to switch on.
        </Text>
      )}
    </div>
  );
}
