import { Button } from '@wizeworks/silicaui-react';
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
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /cms page, split out of
 * cms-page.tsx so each file stays cohesive:
 *
 *  - CmsHero ........... tinted-band hero: split copy + a live editor surface
 *    card (status, autosave, SEO score) that crossfades through
 *    EXAMPLE_BUSINESSES so CMS reads as the engine for ANY publisher.
 *  - CmsLifecycle ...... the editorial pipeline (draft → in review → scheduled →
 *    published), a connected 4-stage rail.
 *  - CmsStructured ..... content-type schema panel beside the typed API response
 *    it produces ("model your content" shown, not asserted).
 *  - CmsEditor ......... an annotated rich-text editor frame with A/B/C/D pins.
 *  - CmsSeoAudit ....... a real per-page audit checklist + a live score.
 *
 * Grounded in docs/12 (CMS PRD). CMS teal is a signal, not fill.
 */

const M = getModuleColor('cms');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── HERO ──────────────────────────────────────────────────────────────────────
export function CmsHero() {
  const lede =
    'sparx CMS is a calm, fast place to publish — a block editor, a media library, structured content, and SEO that does its homework. It runs standalone: a publisher, a docs site, or a portfolio needs no shop. Render it on a hosted sparx site, or pull it headless through the API.';
  const chips = ['standalone, no shop', 'structured content', 'SEO built in', 'REST + GraphQL'];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: M.tint,
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={84} lineHeight={80}>
              Write it. Publish it. Own it
              <Spark color={M.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                maxWidth: '560px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Start publishing →
              </Button>
              <a href="#editor">
                <Button size="lg" variant="outline">
                  See the editor
                </Button>
              </a>
            </div>
            <ul
              className="mkt-cluster"
              style={{ gap: '10px', marginTop: '26px', listStyle: 'none', padding: 0 }}
            >
              {chips.map((c) => (
                <li
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 13px',
                    backgroundColor: 'var(--color-base-100)',
                    border: '1px solid var(--color-base-300)',
                    borderRadius: '9999px',
                  }}
                >
                  <Dot color={M.color} size={6} />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                    }}
                  >
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <EditorCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — a real authoring screen, not a faux app. */
function EditorCard({ business }: { business: ExampleBusiness }) {
  const { article, domain } = business;
  const tools = ['H2', 'B', 'i', '“ ”', '< >', '🔗', '▦'];
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 11px',
              borderRadius: '9999px',
              backgroundColor: M.tint,
              color: M.text,
              fontFamily: SANS,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Dot color={M.color} size={7} /> Draft
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            autosaved 12s ago · v7
          </span>
        </span>
        <span
          className="mkt-hide-on-mobile"
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {domain}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '9px 18px',
          borderBottom: '1px solid var(--color-base-200)',
          backgroundColor: 'var(--color-base-200)',
          flexWrap: 'wrap',
        }}
      >
        {tools.map((t, i) => (
          <span
            key={t}
            style={{
              fontFamily: MONO,
              fontSize: '12px',
              color:
                i === 1
                  ? M.text
                  : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: `1px solid ${i === 1 ? M.color : 'var(--color-base-300)'}`,
              backgroundColor: i === 1 ? M.tint : 'var(--color-base-100)',
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ padding: '22px 22px 8px' }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: M.text,
          }}
        >
          {article.category}
        </span>
        <h2
          style={{
            fontFamily: SANS,
            fontSize: '23px',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.18,
            margin: '10px 0 12px',
          }}
        >
          {article.title}
        </h2>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            margin: '0 0 16px',
          }}
        >
          by {article.author} · {article.readTime}
        </p>
        {['100%', '94%', '76%', '100%', '88%'].map((w, i) => (
          <span
            key={`bar-${i}`}
            style={{
              display: 'block',
              height: '9px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-base-200)',
              width: w,
              margin: '9px 0',
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 18px',
          borderTop: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            fontSize: '12.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: '9999px',
              fontFamily: SANS,
              fontSize: '12px',
              fontWeight: 500,
              color: M.text,
              backgroundColor: M.tint,
              border: `1.5px solid ${M.color}`,
            }}
          >
            {article.seoScore}
          </span>
          SEO score · ready to publish
        </span>
        <Button size="sm" style={{ backgroundColor: M.color }}>
          Publish
        </Button>
      </div>
    </div>
  );
}

// ── LIFECYCLE (editorial pipeline) ──────────────────────────────────────────────
export function CmsLifecycle() {
  const stages = [
    {
      n: '01 · draft',
      title: 'Write',
      body: 'A distraction-free block editor. Autosave every 30 seconds; the last 10 revisions kept and any one restorable — write freely, never lose a word.',
    },
    {
      n: '02 · in review',
      title: 'Hand it off',
      body: 'Share a private preview link so an editor reads the exact published layout before it goes out. Notes stay on the record.',
    },
    {
      n: '03 · scheduled',
      title: 'Set the date',
      body: 'Future-date a post and it publishes itself at the minute you chose. Plan a week or a quarter of content without staying up to hit publish.',
    },
    {
      n: '04 · published',
      title: 'Ship',
      body: 'Live on your domain, in the sitemap, with JSON-LD and an RSS entry. Change the slug later and a 301 redirect is created for you — no link rot.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="From blank page to live, in order"
        lede="Every page and post moves the same calm path — write, hand it off, set the date, ship. Autosave and revisions ride along the whole way, so nothing is ever lost between drafts."
      />
      <div
        className="mkt-pipeline"
        style={{ marginTop: '52px', backgroundColor: 'var(--color-base-100)' }}
      >
        {stages.map((s, i) => (
          <div
            key={s.n}
            className="mkt-stage"
            style={{
              position: 'relative',
              padding: '26px 24px 28px',
              minHeight: '188px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '18px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {s.body}
            </p>
            {i < stages.length - 1 ? (
              <span
                className="mkt-hide-on-tablet"
                style={{
                  position: 'absolute',
                  right: '-11px',
                  top: '38px',
                  zIndex: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-base-100)',
                  border: '1px solid var(--color-base-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: M.color,
                }}
              >
                <ArrowRight size={13} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── STRUCTURED CONTENT (schema → response) ──────────────────────────────────────
export function CmsStructured() {
  const fields: [string, string][] = [
    ['Client name', 'text'],
    ['Industry', 'select'],
    ['Challenge', 'rich text'],
    ['Result', 'number + unit'],
    ['Hero image', 'media ref'],
    ['Author', 'relation'],
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Model your content, not just paragraphs"
        lede="A blog is one shape; a case study, a recipe, or a team profile is another. Define your own content types with typed fields and sparx generates the editing form — then serves it back as clean, typed JSON over the same API."
      />
      <div
        className="mkt-grid-2-1"
        style={{ marginTop: '52px', gap: '24px', alignItems: 'stretch' }}
      >
        <SchemaPanel fields={fields} />
        <ResponsePanel />
      </div>
    </Section>
  );
}

function SchemaPanel({ fields }: { fields: [string, string][] }) {
  return (
    <div
      style={{
        backgroundColor: moduleTint(M.color),
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <Dot color={M.color} size={8} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: M.text,
          }}
        >
          content type · case study
        </span>
      </div>
      {fields.map(([label, type], i) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '13px 20px',
            borderBottom: i < fields.length - 1 ? '1px solid var(--color-base-200)' : 'none',
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>{label}</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              padding: '3px 9px',
              border: '1px solid var(--color-base-300)',
              borderRadius: '9999px',
            }}
          >
            {type}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResponsePanel() {
  const json = `{
  "type": "case_study",
  "clientName": "Atlas Supply Co",
  "industry": "wholesale",
  "result": { "value": 38, "unit": "% faster" },
  "heroImage": { "url": "…/atlas.webp" },
  "author": { "name": "Reyes Fabrication" },
  "status": "published"
}`;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <Dot color={M.color} size={8} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: M.text,
          }}
        >
          GET /v1/case-studies/atlas-supply
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '20px 22px',
          fontFamily: MONO,
          fontSize: '12.5px',
          lineHeight: 1.75,
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          whiteSpace: 'pre',
          overflow: 'auto',
          flex: 1,
        }}
      >
        {json}
      </pre>
    </div>
  );
}

// ── ANNOTATED EDITOR FRAME ──────────────────────────────────────────────────────
export function CmsEditor() {
  const pins = [
    {
      n: 'A',
      title: 'Blocks for everything',
      body: 'Headings, lists, quotes, tables with resizable columns, code blocks, and rules.',
    },
    {
      n: 'B',
      title: 'Embeds & media',
      body: 'Drop in images with captions, or embed a YouTube or Vimeo URL inline.',
    },
    {
      n: 'C',
      title: 'Internal links',
      body: 'Link to any page, post, product, or collection — with a nofollow option for external.',
    },
    {
      n: 'D',
      title: 'Autosave & revisions',
      body: 'Saves every 30s; the last 10 versions kept, any one restorable in a click.',
    },
  ];
  return (
    <Section id="editor" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="An editor that gets out of the way"
        lede="Built on a real rich-text engine — type, format, embed, link. No nested-popover maze, no mystery markup underneath. Everything alongside is a capability you get on day one."
      />
      <div className="mkt-frame-grid" style={{ marginTop: '52px' }}>
        <Cycle
          style={{ minWidth: 0 }}
          items={EXAMPLE_BUSINESSES.map((b) => (
            <EditorFrame key={b.domain} business={b} />
          ))}
        />
        <div>
          {pins.map((p) => (
            <div
              key={p.n}
              style={{
                display: 'flex',
                gap: '13px',
                padding: '18px 20px',
                backgroundColor: 'var(--color-base-200)',
                border: '1px solid var(--color-base-300)',
                borderLeft: `3px solid ${M.color}`,
                borderRadius: '12px',
                marginBottom: '14px',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '12px',
                  color: M.text,
                  flexShrink: 0,
                  paddingTop: '1px',
                }}
              >
                {p.n}
              </span>
              <div>
                <h4
                  style={{
                    margin: '0 0 4px',
                    fontFamily: SANS,
                    fontSize: '14.5px',
                    fontWeight: 500,
                  }}
                >
                  {p.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontFamily: SANS,
                    fontSize: '13px',
                    lineHeight: '20px',
                    color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  }}
                >
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function EditorFrame({ business }: { business: ExampleBusiness }) {
  const { article } = business;
  return (
    <div
      style={{
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-base-100)',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <span style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              style={{ width: 10, height: 10, borderRadius: '9999px', backgroundColor: '#E0E0E4' }}
            />
          ))}
        </span>
        <span
          style={{
            marginLeft: '8px',
            fontFamily: MONO,
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '7px',
            padding: '5px 12px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          app.sparx.works/cms/{article.slug}
        </span>
      </div>
      <div style={{ padding: '26px 30px 30px' }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: M.text,
          }}
        >
          {article.category}
        </span>
        <h3
          style={{
            margin: '10px 0 6px',
            fontFamily: SANS,
            fontSize: '24px',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {article.title}
        </h3>
        <p
          style={{
            margin: '0 0 18px',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          by {article.author} · {article.readTime} · v12 <Pin n="D" />
        </p>
        {['100%', '94%', '100%'].map((w, i) => (
          <span
            key={`top-${i}`}
            style={{
              display: 'block',
              height: '9px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-base-200)',
              width: w,
              margin: '9px 0',
            }}
          />
        ))}
        <div
          style={{
            height: '120px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-base-200)',
            margin: '16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            fontFamily: MONO,
            fontSize: '12px',
          }}
        >
          <Pin n="B" /> embedded video · from media library
        </div>
        {['94%', '76%'].map((w) => (
          <span
            key={`btm-${w}`}
            style={{
              display: 'block',
              height: '9px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-base-200)',
              width: w,
              margin: '9px 0',
            }}
          />
        ))}
        <p
          style={{
            margin: '14px 0 0',
            fontFamily: SANS,
            fontSize: '12.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          <Pin n="A" /> blocks &nbsp; <Pin n="C" /> internal links
        </p>
      </div>
    </div>
  );
}

/** A small teal annotation pin matching the A/B/C/D callouts. */
function Pin({ n }: { n: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 19,
        height: 19,
        borderRadius: '9999px',
        backgroundColor: M.color,
        color: '#FFFFFF',
        fontFamily: MONO,
        fontSize: '11px',
        fontWeight: 500,
        verticalAlign: 'middle',
      }}
    >
      {n}
    </span>
  );
}

// ── SEO AUDIT ───────────────────────────────────────────────────────────────────
export function CmsSeoAudit() {
  const checks: { label: string; meta: string; warn?: boolean }[] = [
    { label: 'SEO title length', meta: '54 / 60 chars' },
    { label: 'Meta description', meta: '148 / 160 chars' },
    { label: 'One unique H1', meta: 'present' },
    { label: 'Images have alt text', meta: '3 of 4', warn: true },
    { label: 'Internal links present', meta: '5 links' },
    { label: 'JSON-LD & canonical', meta: 'auto-generated' },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="SEO that checks its own work"
        lede="Every page gets a live audit as you write — not a report you run later. Title and meta lengths, a unique H1, alt text, internal links, and word count, each scored before you publish. Sitemaps and JSON-LD generate themselves."
      />
      <div className="mkt-seo-grid" style={{ marginTop: '52px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            padding: '30px',
            backgroundColor: moduleTint(M.color),
            border: '1px solid var(--color-base-300)',
            borderRadius: '14px',
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: '64px',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: M.text,
            }}
          >
            98
            <span
              style={{
                fontSize: '22px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              /100
            </span>
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '21px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            Live SEO score on &ldquo;Pour-over basics.&rdquo; Fix the one warning and it&rsquo;s a
            clean 100 — all before this post ever goes live.
          </span>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {checks.map((c, i) => (
            <div
              key={c.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '13px',
                padding: '16px 22px',
                borderBottom: i < checks.length - 1 ? '1px solid var(--color-base-200)' : 'none',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: c.warn ? '#FFFBEB' : M.tint,
                  color: c.warn ? '#B45309' : M.text,
                }}
              >
                {c.warn ? <Bang size={12} /> : <Check size={12} color={M.text} />}
              </span>
              <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>{c.label}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: MONO,
                  fontSize: '12px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {c.meta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── glyphs ──────────────────────────────────────────────────────────────────────
function ArrowRight({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Bang({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12" y2="17" />
    </svg>
  );
}
