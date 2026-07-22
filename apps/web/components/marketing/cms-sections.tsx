import { Button } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
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

// ── HERO ──────────────────────────────────────────────────────────────────────
export function CmsHero() {
  const lede =
    'sparx CMS is a calm, fast place to publish — a block editor, a media library, structured content, and SEO that does its homework. It runs standalone: a publisher, a docs site, or a portfolio needs no shop. Render it on a hosted sparx site, or pull it headless through the API.';
  const chips = ['standalone, no shop', 'structured content', 'SEO built in', 'REST + GraphQL'];
  return (
    <section className={`${M.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={84} lineHeight={80}>
              Write it. Publish it. Own it
              <Spark color={M.color} />
            </Display>
            <p className="text-ink-muted mt-7 max-w-[560px] font-sans text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
              {lede}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Start publishing →
              </Button>
              <a href="#editor">
                <Button size="lg" variant="outline">
                  See the editor
                </Button>
              </a>
            </div>
            <ul className="mt-6 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li
                  key={c}
                  className="border-base-300 bg-base-100 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                >
                  <Dot color={M.color} size={6} />
                  <span className="text-ink-muted text-mini font-mono">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full min-w-0 flex-1">
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
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border shadow-lg">
      <div className="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={`${M.bg} bg-soft ${M.ink} text-mini inline-flex items-center gap-[7px] rounded-full px-3 py-1 font-sans font-medium`}
          >
            <Dot color={M.color} size={7} /> Draft
          </span>
          <span className="text-ink-subtle text-micro font-mono">autosaved 12s ago · v7</span>
        </span>
        <span className="mkt-hide-on-mobile text-ink-subtle text-micro font-mono">{domain}</span>
      </div>
      {/* Editor toolbar — mockup UI mimicry, so the mono glyph chips stay. */}
      <div className="border-base-200 bg-base-200 flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
        {tools.map((t, i) => (
          <span
            key={t}
            className={`${
              i === 1
                ? `${M.bg} bg-soft ${M.ink} border-module-cms`
                : 'bg-base-100 text-ink-muted border-base-300'
            } text-mini rounded-md border px-2 py-0.5 font-mono`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="px-5.5 pt-5.5 pb-2">
        <span className={`${M.ink} text-micro font-mono tracking-[0.05em] uppercase`}>
          {article.category}
        </span>
        <h2 className="text-h3 mt-2.5 mb-3 font-sans font-medium tracking-[-0.02em]">
          {article.title}
        </h2>
        <p className="text-ink-subtle text-caption mt-0 mb-4 font-sans">
          by {article.author} · {article.readTime}
        </p>
        {['100%', '94%', '76%', '100%', '88%'].map((w, i) => (
          <span
            key={`bar-${i}`}
            className="bg-base-200 my-2.5 block h-2.5 rounded-full"
            // Per-line width is what makes the placeholder read as prose.
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="border-base-300 bg-base-200 flex items-center justify-between gap-3 border-t px-4 py-3.5">
        <span className="text-ink-muted text-mini inline-flex items-center gap-2">
          <span
            className={`${M.bg} bg-soft ${M.ink} border-module-cms text-mini inline-flex size-[30px] items-center justify-center rounded-full border font-sans font-medium`}
          >
            {article.seoScore}
          </span>
          SEO score · ready to publish
        </span>
        <Button color="module-cms" size="sm">
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
      title: 'Write',
      body: 'A distraction-free block editor. Autosave every 30 seconds; the last 10 revisions kept and any one restorable — write freely, never lose a word.',
    },
    {
      title: 'Hand it off',
      body: 'Share a private preview link so an editor reads the exact published layout before it goes out. Notes stay on the record.',
    },
    {
      title: 'Set the date',
      body: 'Future-date a post and it publishes itself at the minute you chose. Plan a week or a quarter of content without staying up to hit publish.',
    },
    {
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
      <div className="mkt-pipeline bg-base-100 mt-13">
        {stages.map((s, i) => (
          <div
            key={s.title}
            className="mkt-pipe-cell relative flex min-h-[188px] flex-col gap-3 px-6 pt-6 pb-7"
          >
            <h3 className="text-lede m-0 flex items-center gap-2 font-sans font-medium tracking-[-0.01em]">
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <p className="text-ink-muted text-caption m-0 font-sans">{s.body}</p>
            {i < stages.length - 1 ? (
              <span
                className="mkt-hide-on-tablet border-base-300 bg-base-100 absolute top-[38px] -right-[11px] z-2 flex size-[22px] items-center justify-center rounded-full border"
                // Module hue as a VALUE for the inline SVG's currentColor.
                style={{ color: M.color }}
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
      <div className="mt-13 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        <SchemaPanel fields={fields} />
        <ResponsePanel />
      </div>
    </Section>
  );
}

function SchemaPanel({ fields }: { fields: [string, string][] }) {
  return (
    <div
      className={`${M.bg} bg-soft border-base-300 flex flex-col overflow-hidden rounded-xl border`}
    >
      {/* Panel chrome label — this names the mockup's own header bar, not a
          marketing heading below it. */}
      <div className="border-base-300 flex items-center gap-2 border-b px-5 py-3.5">
        <Dot color={M.color} size={8} />
        <span className={`${M.ink} text-micro font-mono tracking-[0.05em] uppercase`}>
          content type · case study
        </span>
      </div>
      {fields.map(([label, type], i) => (
        <div
          key={label}
          className={`flex items-center justify-between gap-3 px-5 py-3 ${
            i < fields.length - 1 ? 'border-base-200 border-b' : ''
          }`}
        >
          <span className="text-small font-sans font-medium">{label}</span>
          <span className="text-ink-subtle text-mini border-base-300 rounded-full border px-2 py-0.5 font-mono">
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
    <div className="border-base-300 bg-base-100 flex flex-col overflow-hidden rounded-xl border">
      <div className="border-base-300 flex items-center gap-2 border-b px-5 py-3.5">
        <Dot color={M.color} size={8} />
        <span className={`${M.ink} text-micro font-mono tracking-[0.05em] uppercase`}>
          GET /v1/case-studies/atlas-supply
        </span>
      </div>
      <pre className="text-ink-muted text-mini m-0 flex-1 overflow-auto px-5.5 py-5 font-mono leading-[1.75] whitespace-pre">
        {json}
      </pre>
    </div>
  );
}

// ── ANNOTATED EDITOR FRAME ──────────────────────────────────────────────────────
export function CmsEditor() {
  // `n` here is NOT a decorative step marker (RULE #2) — it is an annotation
  // LEGEND. The same letters render as <Pin n="A" /> inside the EditorFrame
  // below, so the callout and the thing it points at stay tied together.
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
      <div className="mkt-frame-grid mt-13">
        <Cycle
          className="min-w-0"
          items={EXAMPLE_BUSINESSES.map((b) => (
            <EditorFrame key={b.domain} business={b} />
          ))}
        />
        <div>
          {pins.map((p) => (
            <div
              key={p.n}
              // The module hue rides the soft wash, NOT a 3px left stripe — the
              // stripe is a retired brand device (and the most recognizable
              // generated-UI tell). Same treatment as every other module card.
              className={`${M.bg} bg-soft border-base-300 mb-3.5 flex gap-3 rounded-xl border px-5 py-4`}
            >
              {/* p.n is the annotation KEY, tied to the matching <Pin n> inside
                  the EditorFrame — never a decorative step marker. */}
              <span className={`${M.ink} text-mini shrink-0 pt-px font-mono`}>{p.n}</span>
              <div>
                <h4 className="text-small mt-0 mb-1 font-sans font-medium">{p.title}</h4>
                <p className="text-ink-muted text-caption m-0 font-sans">{p.body}</p>
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
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-xl border shadow-lg">
      <div className="border-base-300 bg-base-200 flex items-center gap-2 border-b px-4 py-3">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="bg-base-300 size-2.5 rounded-full" />
          ))}
        </span>
        <span className="text-ink-subtle text-mini border-base-300 bg-base-100 ml-2 min-w-0 flex-1 overflow-hidden rounded-md border px-3 py-1 font-mono text-ellipsis whitespace-nowrap">
          app.sparx.works/cms/{article.slug}
        </span>
      </div>
      <div className="px-7.5 pt-6 pb-7.5">
        <span className={`${M.ink} text-micro font-mono tracking-[0.05em] uppercase`}>
          {article.category}
        </span>
        <h3 className="text-h2 mt-2.5 mb-1.5 font-sans font-medium tracking-[-0.02em]">
          {article.title}
        </h3>
        <p className="text-ink-subtle text-caption mt-0 mb-4 font-sans">
          by {article.author} · {article.readTime} · v12 <Pin n="D" />
        </p>
        {['100%', '94%', '100%'].map((w, i) => (
          <span
            key={`top-${i}`}
            className="bg-base-200 my-2.5 block h-2.5 rounded-full"
            // Per-line width is what makes the placeholder read as prose.
            style={{ width: w }}
          />
        ))}
        <div className="bg-base-200 text-ink-subtle text-mini my-4 flex h-30 items-center justify-center gap-2 rounded-[10px] font-mono">
          <Pin n="B" /> embedded video · from media library
        </div>
        {['94%', '76%'].map((w) => (
          <span
            key={`btm-${w}`}
            className="bg-base-200 my-2.5 block h-2.5 rounded-full"
            style={{ width: w }}
          />
        ))}
        <p className="text-ink-subtle text-mini mt-3.5 mb-0 font-sans">
          <Pin n="A" /> blocks &nbsp; <Pin n="C" /> internal links
        </p>
      </div>
    </div>
  );
}

/**
 * A small teal annotation pin matching the A/B/C/D callouts. The solid module
 * fill supplies its own paired ink, so there is no hand-picked white on teal.
 */
function Pin({ n }: { n: string }) {
  return (
    <span
      className={`${M.bg} text-module-cms-content text-micro inline-flex size-[19px] items-center justify-center rounded-full align-middle font-mono font-medium`}
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
      <div className="mkt-seo-grid mt-13">
        <div
          className={`${M.bg} bg-soft border-base-300 flex flex-col gap-4 rounded-xl border p-7.5`}
        >
          <span
            className={`${M.ink} font-sans text-[64px] leading-none font-medium tracking-[-0.03em]`}
          >
            98
            <span className="text-ink-subtle text-h3">/100</span>
          </span>
          <span className="text-ink-muted text-small font-sans">
            Live SEO score on &ldquo;Pour-over basics.&rdquo; Fix the one warning and it&rsquo;s a
            clean 100 — all before this post ever goes live.
          </span>
        </div>
        <div className="border-base-300 bg-base-100 overflow-hidden rounded-xl border">
          {checks.map((c, i) => (
            <div
              key={c.label}
              className={`flex items-center gap-3 px-5.5 py-4 ${
                i < checks.length - 1 ? 'border-base-200 border-b' : ''
              }`}
            >
              <span
                className={`${
                  c.warn ? 'bg-warning bg-soft text-warning' : `${M.bg} bg-soft ${M.ink}`
                } flex size-[22px] shrink-0 items-center justify-center rounded-full`}
              >
                {c.warn ? <Bang size={12} /> : <Check size={12} color="currentColor" />}
              </span>
              <span className="text-small font-sans font-medium">{c.label}</span>
              <span className="text-ink-subtle text-mini ml-auto font-mono">{c.meta}</span>
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
