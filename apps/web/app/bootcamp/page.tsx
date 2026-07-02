// The /bootcamp page (docs/114 §B.6) — the public Business OS Bootcamp discovery
// surface. Bespoke marketing sections (hero, the free-to-build arc, who it's for,
// format labels) wrap a URL-driven faceted directory, then a dark host-CTA and a
// bootcamp-specific FAQ. Energetic accent = commerce orange, distinct from the
// partner program's indigo.

import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Faq } from '@/components/marketing/faq';
import { Spark } from '@/components/marketing/primitives';
import { BootcampArc } from '@/components/marketing/bootcamp-arc';
import {
  BOOTCAMP_FAQ,
  BootcampFormats,
  BootcampHero,
  BootcampHostCta,
  BootcampWhoFor,
} from '@/components/marketing/bootcamp-sections';
import { fetchBootcamps } from '@/lib/bootcamp';
import { BootcampDirectory } from './_components/directory-section';
import type { BootcampParams, DatePreset } from './_components/facet-bar';

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: 'Business OS Bootcamp — build your business, launch on sparx',
  description:
    'Find a Business OS Bootcamp near you or online. Certified sparx partners guide you through building a real business — storefront, CRM, email, and automation — and graduating the day you publish.',
  alternates: { canonical: '/bootcamp' },
  openGraph: {
    title: 'Business OS Bootcamp — build your business. Launch on sparx.',
    description:
      'In-person and virtual bootcamps led by certified sparx partners. Build the whole time free; graduate when you publish.',
    url: '/bootcamp',
    type: 'website',
  },
};

function normalize(sp: SearchParams): BootcampParams {
  const out: BootcampParams = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v.join(',') : v;
    if (val) out[k] = val;
  }
  delete out.cursor;
  delete out.limit;
  return out;
}

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Presets resolve to concrete from/to ranges so the API contract stays date-based
// while the UI reads "This month / Next 3 months". Active when the URL's range
// matches the freshly-computed preset.
function buildDatePresets(current: BootcampParams): DatePreset[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = toDate(new Date(Date.UTC(y, m, 1)));
  const monthEnd = toDate(new Date(Date.UTC(y, m + 1, 0)));
  const today = toDate(new Date(Date.UTC(y, m, now.getUTCDate())));
  const in3 = toDate(new Date(Date.UTC(y, m + 3, now.getUTCDate())));
  const raw = [
    { key: 'month', label: 'This month', from: monthStart, to: monthEnd },
    { key: 'quarter', label: 'Next 3 months', from: today, to: in3 },
  ];
  return raw.map((p) => ({ ...p, active: current.from === p.from && current.to === p.to }));
}

export default async function BootcampPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const current = normalize(await searchParams);
  const datePresets = buildDatePresets(current);
  const page = await fetchBootcamps({ ...current, limit: '24' });

  return (
    <>
      <Nav />
      <BootcampHero />
      <BootcampArc />
      <BootcampWhoFor />
      <BootcampFormats />
      <BootcampDirectory page={page} current={current} datePresets={datePresets} />
      <BootcampHostCta />
      <Faq
        id="faq"
        items={BOOTCAMP_FAQ}
        accent="var(--module-commerce)"
        heading={
          <>
            Bootcamp questions
            <Spark color="var(--module-commerce)" />
          </>
        }
        lede="What you'll build, what it costs, and how registration works — before you sign up."
      />
      <Footer />
    </>
  );
}
