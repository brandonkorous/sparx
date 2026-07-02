import type { ReactNode } from 'react';
import { Button } from '@sparx/ui';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  moduleTint,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { CmsHero, CmsLifecycle, CmsStructured, CmsEditor, CmsSeoAudit } from './cms-sections';
import { Faq, type FaqItem } from './faq';

/**
 * The /cms marketing page — CMS is the **calm publishing spine** of sparx. The
 * thesis traces one piece of content from blank editor → structured fields →
 * published article, then proves the craft around it (media, SEO audit, the
 * editorial workflow), insists it stands alone with NO shop, and exposes it
 * headless. The register is editorial and considered — the opposite of
 * commerce's conversion urgency. CMS teal is a *signal* (status dots, SEO pass
 * marks, the spark) — never flood fill.
 *
 * Bespoke + full-length, modeled on commerce-page.tsx / builder-page.tsx; the
 * markup-heavy device sections (the editor surface, the pipeline, the
 * schema→response panels, the annotated editor frame, the SEO audit) live in
 * cms-sections.tsx so each file stays cohesive.
 *
 * Facts are grounded in docs/12 (CMS PRD) + docs/17 (billing). The editor is a
 * real rich-text engine (TipTap/ProseMirror), autosave every 30s, last 10
 * revisions; SEO audit checks are the real per-page checklist; media transcodes
 * to WebP + responsive sizes on the CDN. Headless is REST + GraphQL via
 * @sparx/site-sdk. Flat $49/mo, standalone, no tiers and no bundle (doc 17 has
 * no "Builder + CMS" bundle).
 */
export function CmsPage() {
  return (
    <>
      <CmsHero />
      <CmsLifecycle />
      <CmsStructured />
      <CmsEditor />
      <CmsSeoAudit />
      <CmsCapabilities />
      <CmsStandalone />
      <CmsProof />
      <CmsPricing />
      <Faq
        items={CMS_FAQ}
        id="faq"
        accent={M.color}
        heading={
          <>
            CMS questions
            <Spark color={M.color} />
          </>
        }
        lede="Standalone use, headless access, SEO, and how it fits your stack — answered straight. Still deciding? Read the CMS docs or start the 14-day trial."
      />
      <CmsCta />
    </>
  );
}

const M = getModuleColor('cms');
const BUILDER = getModuleColor('builder');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// Page-specific FAQ. Real evaluation questions for sparx CMS, answered straight
// and grounded in docs/12 (PRD) + docs/17 (billing) — no tier/plan language.
// Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const CMS_FAQ: FaqItem[] = [
  {
    id: 'cms-standalone',
    question: 'Can I use the CMS without a store?',
    answer:
      'Yes — CMS is a standalone module. A publisher, a documentation site, a portfolio, or a content team can run entirely on sparx CMS without ever turning on Commerce. The content engine and the commerce engine are deliberately separate, so you only pay for what you use.',
  },
  {
    id: 'cms-pricing',
    question: 'How much does sparx CMS cost?',
    answer:
      'A flat $49/mo. No tiers, no per-seat charge, and no per-record metering — your pages, posts, and media are unlimited. Add any other modules à la carte and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'cms-headless',
    question: 'Can I use it as a headless CMS?',
    answer:
      'Yes. Every content type is available over REST and GraphQL, including your custom fields, authenticated with a read:content API key. The @sparx/site-sdk package ships typed helpers, so you can render content in Next.js, Astro, SvelteKit, a native app, or anything else — no Builder required.',
  },
  {
    id: 'cms-editor',
    question: 'What can the editor actually do?',
    answer:
      'It is a real rich-text editor built on ProseMirror: headings, lists, blockquotes, tables with resizable columns, code blocks, images with captions, embedded video, and internal or external links. It autosaves every 30 seconds and keeps the last 10 revisions, any of which you can restore.',
  },
  {
    id: 'cms-builder',
    question: 'Do I need Builder to publish a blog?',
    answer:
      'Only if you want sparx to host and render the site. CMS holds and serves the content; Builder is the website layer that puts it on your own domain with SSL and a CDN. Run CMS standalone and pull the content into your own frontend over the API, or add Builder to get it rendered for you.',
  },
  {
    id: 'cms-seo',
    question: 'What SEO tools are included?',
    answer:
      'Per-page SEO and OG fields with character counters, canonical URLs, robots directives, and JSON-LD auto-generated for articles. A live audit panel scores title length, meta length, a unique H1, image alt text, internal links, and word count as you write. Sitemaps generate automatically and 301 redirects are created when a slug changes.',
  },
  {
    id: 'cms-migrate',
    question: 'Can I migrate my existing content?',
    answer:
      'Yes. You can import posts, pages, media, and redirects, and bulk-import a CSV of 301 redirects so existing links never break. Because everything is also available over the API, you can script a migration against your old platform and write straight into sparx.',
  },
];

// ── CAPABILITY GRID ───────────────────────────────────────────────────────────
function CmsCapabilities() {
  const caps = [
    {
      title: 'Media library',
      body: 'Drag-drop uploads auto-transcode to WebP and responsive sizes, served from the CDN. Search by name or alt text, with a usage count per asset.',
    },
    {
      title: 'Blog & authors',
      body: 'Multiple authors, categories and tags, featured images, excerpts, reading time, and an RSS feed — with related posts wired by tag.',
    },
    {
      title: 'Navigation menus',
      body: 'Build header, footer, and mega menus that link to any page, post, product, collection, or external URL — no theme code required.',
    },
    {
      title: 'Redirects, handled',
      body: 'Manual 301s plus auto-redirects when a slug changes, with chain and loop detection. Bulk-import a CSV when you migrate.',
    },
    {
      title: 'Localization',
      body: 'Language variants per page with hreflang generated, separate SEO per language, and a subdirectory or subdomain URL structure.',
    },
    {
      title: 'Pages & landing pages',
      body: 'About, contact, policies, and campaign pages — all the static content a site needs, with the same editor and SEO tooling.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Everything a publishing team needs"
        lede="The CMS isn’t just an editor — it’s the whole content layer, with the parts most tools charge extra for already in the box."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {caps.map((c) => (
          <div
            key={c.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '172px',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: M.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dot color={M.color} size={9} />
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {c.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── STANDALONE (no shop) ──────────────────────────────────────────────────────
function CmsStandalone() {
  const ways: {
    tag: string;
    title: string;
    body: string;
    points: string[];
    dot: string;
    runs: string;
  }[] = [
    {
      tag: 'cms + builder',
      title: 'Rendered on a hosted site',
      body: 'Pair CMS with Builder and your pages and posts render on your own domain — fast, on the CDN, with SSL handled. Selling stays optional; turn Commerce on the day you want it.',
      points: [
        'Your theme, your domain, automatic SSL.',
        'Blog, pages, and media on one design system.',
        'Add Commerce later — same content, no rebuild.',
      ],
      dot: BUILDER.color,
      runs: 'CMS + Builder',
    },
    {
      tag: 'cms + your stack',
      title: 'Headless to any frontend',
      body: 'Query content over REST and GraphQL and render it in Next.js, Astro, SvelteKit, or a native app. The @sparx/site-sdk ships typed helpers for every content type.',
      points: [
        'Full REST + GraphQL on every content type.',
        'Custom fields are queryable and typed.',
        'Webhook on publish · drive content over MCP.',
      ],
      dot: M.color,
      runs: 'CMS + API · MCP',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="No shop required — ever"
        lede="CMS is its own module. A publisher, a docs site, or a content team can run entirely on sparx without a cart in sight — and pull it any way they like."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {ways.map((w) => (
          <div
            key={w.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '32px',
              backgroundColor: moduleTint(w.dot),
              border: '1px solid var(--color-border-default)',
              borderRadius: '14px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: w.dot === M.color ? M.text : BUILDER.text,
              }}
            >
              {w.tag}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '24px',
                fontWeight: 500,
                letterSpacing: '-0.02em',
              }}
            >
              {w.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '24px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {w.body}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
              {w.points.map((p) => (
                <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                  <span style={{ paddingTop: '7px', flexShrink: 0 }}>
                    <Dot color={w.dot} size={7} />
                  </span>
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: '14.5px',
                      lineHeight: '23px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {p}
                  </span>
                </li>
              ))}
            </ul>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                marginTop: 'auto',
                paddingTop: '4px',
              }}
            >
              {w.runs}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PROOF ROW (dark) ──────────────────────────────────────────────────────────
function CmsProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={M.color} />}</>,
      l: 'database under content, customers, and orders — nothing to sync',
    },
    { n: 'REST + GraphQL', l: 'on every content type and custom field — headless from day one' },
    { n: '10', l: 'revisions kept per page, any one restorable — autosave every 30s' },
    { n: '$0', l: 'to export — full JSON or SQL from the dashboard, no ticket' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div style={{ maxWidth: '760px' }}>
        <Display size={46} lineHeight={48} color="#FFFFFF">
          Your words, your structure, your data
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: '22px 0 0',
          }}
        >
          Content lives in the same database as everything else on sparx — no separate CMS to sync,
          no plugin sprawl, no platform that holds your archive hostage. Export the whole thing
          whenever you want.
        </p>
      </div>
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px', gap: 0 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0' : '0 0 0 32px',
              borderLeft: i === 0 ? 'none' : '1px solid #262626',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(36px, 5vw, 54px)',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: '#A1A1AA',
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ─────────────────────────────────────────────────────────────
function CmsPricing() {
  return (
    <Section padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          backgroundColor: moduleTint(M.color),
          border: '1px solid var(--color-border-default)',
          borderRadius: '14px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-text-primary)',
              }}
            >
              $49
            </span>
            <span
              style={{ fontFamily: SANS, fontSize: '16px', color: 'var(--color-text-tertiary)' }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A flat $49/mo, standalone — no Builder required, no tiers, no per-seat or per-record
            metering. Run it headless against the API, or add Builder when you want it rendered on a
            hosted sparx site. One bill with everything else; start free for 14 days, no card to
            begin.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
            Activate CMS
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ──────────────────────────────────────────────────────────
function CmsCta() {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '36px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Start publishing today
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Open the editor, write your first post, and publish to your own domain — or pull it
          straight into your own frontend over the API. No migration weekend, no contract; turn it
          off the day you stop, and your content stays yours.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" style={{ backgroundColor: M.color }}>
            Start publishing →
          </Button>
          <a href="#editor">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See the editor
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
