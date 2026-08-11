// Shared PREVIEW machinery for the six personal-portfolio templates — the review aid (NOT
// the shipped payload). Every `gen-portfolio-<persona>.ts` calls `writePortfolioPreview` to
// drop a self-contained HTML file into the scratch dir so the template can be eyeballed in a
// plain browser exactly as the storefront renders it. The lean sibling of
// `template-sites/preview.ts`: a portfolio has no commerce, so the sample host only fabricates
// the `cms.blog_post` project list (+ a single-project scope for the case-study detail).
//
// WHY RELATIVE IMPORTS — see the harness (marketplace-catalog has no node_modules). The
// silica node primitives come through silica-catalog's own copy so the nodes this file
// touches are the SAME module instance as the ones the harness/catalog mint.

import { execFileSync } from 'node:child_process';
import { promises as fs, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  el,
  type Node,
  type Theme,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { renderSilicaBody } from '../../../packages/silica-catalog/src/render';
import {
  createSilicaResolver,
  defaultSilicaFormat,
} from '../../../packages/builder-schemas/src/silica-resolve';
import { buildSilicaThemeCssFromTheme } from '../../../packages/site-themes/src/v2/silica-css';

import { composePortfolioSite, type PortfolioSiteSpec } from './harness';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/** The STANDARD preview output dir — a stable, repo-relative location (gitignored), shared
 *  with the template previews so the flow is identical. `screenshot-template.mjs` reads
 *  `preview-<slug>.html` from here. */
export const PREVIEW_DIR = join(here, '..', '.preview');

// ── The minimal shapes the sample host reads off a spec ──────────────────────────

interface PvAsset {
  id: string;
  url: string;
  alt: string;
}
interface PvContentEntry {
  typeKey: string;
  slug: string;
  body: {
    title: string;
    excerpt?: string;
    featuredImage?: { $asset?: string };
    body?: { type: string; content?: unknown[] };
  };
}

/** Build the sample-data host so the work index's bound project grid + the case-study
 *  detail resolve to the bundle's OWN example records. A portfolio's records are all
 *  `blog_post` projects:
 *   · `cms.blog_post`  — every project (the linkable index grid repeats this)
 *   · `blog_post`      — the FIRST project alone (the detail page's collection-of-one scope)
 */
function buildSampleHost(spec: PortfolioSiteSpec) {
  const assets = spec.assets as PvAsset[];
  const content = spec.content as PvContentEntry[];

  const assetUrl = (id: string): string => {
    const a = assets.find((x) => x.id === id);
    if (!a) throw new Error(`portfolio-preview(${spec.slug}): unknown asset "${id}"`);
    return a.url;
  };

  const projectOf = (e: PvContentEntry) => ({
    title: e.body.title,
    excerpt: e.body.excerpt ?? '',
    date: 'March 2026',
    category: 'Project',
    featuredImage: e.body.featuredImage?.$asset
      ? { url: assetUrl(e.body.featuredImage.$asset), alt: e.body.title }
      : null,
    authorName: spec.brand.businessName,
    slug: e.slug,
    url: `/blog/${e.slug}`,
  });

  const projects = content.filter((e) => e.typeKey === 'blog_post').map(projectOf);

  const root: Record<string, unknown> = {
    site: { identity: { name: spec.brand.businessName } },
    cms: { blog_post: projects },
    // The detail page repeats over `blog_post` (a collection-of-one at runtime); the preview
    // scopes it to the first project so the case-study layout renders with real content.
    blog_post: projects.slice(0, 1),
    ...(projects[0]
      ? {
          title: projects[0].title,
          excerpt: projects[0].excerpt,
          date: projects[0].date,
          category: projects[0].category,
          featuredImage: projects[0].featuredImage,
          authorName: projects[0].authorName,
        }
      : {}),
  };
  return createSilicaResolver({ root, format: defaultSilicaFormat });
}

// ── Tailwind compile (reuses the template-sites compiler) ────────────────────────

function runTailwind(
  cli: string,
  inputPath: string,
  inputCss: string,
  bodyPath: string,
  bodyHtml: string,
  outPath: string
): string {
  writeFileSync(bodyPath, bodyHtml, 'utf8');
  writeFileSync(inputPath, inputCss, 'utf8');
  try {
    execFileSync('node', [cli, '-i', inputPath, '-o', outPath], { cwd: repoRoot, stdio: 'pipe' });
    return readFileSync(outPath, 'utf8');
  } finally {
    rmSync(inputPath, { force: true });
  }
}

function compilePreviewCss(slug: string, bodyHtml: string, scratchDir: string): string {
  const bodyPath = join(scratchDir, `preview-${slug}.body.html`);
  const inputPath = join(repoRoot, 'apps', 'site', `_preview-${slug}.css`);
  const outPath = join(scratchDir, `preview-${slug}.util.css`);
  const cli = join(here, '..', 'template-sites', 'tailwind-compile.mjs');
  const input = `@import 'tailwindcss';
@plugin '@wizeworks/silicaui' {
  colors: primary, secondary, accent, neutral, info, success, warning, error, danger, highlight;
}
@import '../../packages/silica-catalog/src/builder-vocabulary.css';
@source '${bodyPath.replace(/\\/g, '/')}';
@source '../../packages/silica-catalog/src/**/*.{ts,tsx}';
`;
  return runTailwind(cli, inputPath, input, bodyPath, bodyHtml, outPath);
}

function fontsHref(heading: string, body: string): string {
  const fam = (f: string) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`;
  const uniq = [heading, body].filter((v, i, a) => a.indexOf(v) === i);
  return `https://fonts.googleapis.com/css2?${uniq.map(fam).join('&')}&display=swap`;
}

/** Swap the frame's LIVE host cores for static stand-ins so the preview chrome reads like the
 *  real storefront. Preview-only. */
function staticizeHostNodes(node: unknown, brandName: string): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n.kind === 'host') {
    if (n.component === 'site.brand') {
      return el('a', 'flex items-center text-lg font-semibold tracking-tight text-base-content', {
        attrs: { href: '/' },
        text: brandName,
      });
    }
    return null; // theme toggle + legal links have nothing to render without the live host
  }
  if (Array.isArray(n.children)) {
    n.children = n.children.map((c) => staticizeHostNodes(c, brandName)).filter((c) => c !== null);
  }
  return node;
}

/** Replace a page body's LIVE cores (the `cms.article-body` server-computed host) with a
 *  labeled placeholder, so the review preview reads "the written body renders here" instead
 *  of a blank gap. The bespoke masthead a template authors renders normally. Preview-only. */
function placeholderizeCores(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n.kind === 'host') {
    const key = n.component ?? 'core';
    return el(
      'div',
      'mx-auto my-8 w-full max-w-3xl rounded-box border border-dashed border-base-300 bg-base-200 px-6 py-16 text-center text-base-content',
      { text: `▦ live "${key}" renders the project's written body here on the storefront` }
    );
  }
  if (Array.isArray(n.children)) {
    n.children = n.children.map((c) => placeholderizeCores(c));
  }
  return node;
}

export interface WritePortfolioPreviewResult {
  path: string;
}

function faces(theme: Theme): { heading: string; body: string } {
  const fonts = (theme as { fonts?: { sans?: { family?: string }; head?: { family?: string } } })
    .fonts;
  const tokens = (theme as { tokens?: Record<string, string> }).tokens ?? {};
  const body = fonts?.sans?.family ?? 'Inter';
  const heading = fonts?.head?.family ?? body;
  void tokens;
  return { heading, body };
}

/**
 * Render ALL of ONE portfolio's pages to a single self-contained HTML file — the branded
 * chrome once at the top (Home in its real frame), then every page body (Work, About,
 * Contact, Project) stacked under a label banner, in the bespoke theme the bundle ships.
 * Bound content (the project grid, the case-study fields) resolves to the bundle's own
 * example records via the sample host; the written-body core shows a labeled placeholder (it
 * renders server-side on the live storefront). The third generator oracle.
 */
export async function writePortfolioPreview(
  spec: PortfolioSiteSpec,
  theme: Theme,
  scratchDir: string = PREVIEW_DIR
): Promise<WritePortfolioPreviewResult> {
  await fs.mkdir(scratchDir, { recursive: true });
  const site = composePortfolioSite(spec);
  const pages = site.pages as { name: string; root: Node }[];
  const host = buildSampleHost(spec);
  const frameRoot = staticizeHostNodes(
    (site.frame as { root: Node }).root,
    spec.brand.businessName
  ) as Node;

  const clone = (n: Node): Node => JSON.parse(JSON.stringify(n)) as Node;
  const label = (name: string): string => `<div class="__pv-label">${name}</div>`;
  const renderPage = (root: Node, framed: boolean): string =>
    renderSilicaBody(placeholderizeCores(clone(root)) as Node, {
      host,
      ...(framed ? { frame: frameRoot } : {}),
      html: { ids: false },
    });

  const parts: string[] = [];
  parts.push(label('Home (with site chrome)'));
  parts.push(renderPage(pages[0]!.root, true));
  for (const pg of pages.slice(1)) {
    parts.push(label(pg.name));
    parts.push(renderPage(pg.root, false));
  }
  const bodyHtml = parts.join('\n');

  const utilCss = compilePreviewCss(spec.slug, bodyHtml, scratchDir);
  const themeCss = buildSilicaThemeCssFromTheme(
    theme as Parameters<typeof buildSilicaThemeCssFromTheme>[0]
  );
  const { heading, body } = faces(theme);

  const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${spec.brand.businessName} — ${spec.name} preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref(heading, body)}" />
<style>${utilCss}</style>
<style>${themeCss}</style>
<style>
  html { scroll-behavior: smooth; }
  body { background: var(--color-base-100); color: var(--color-base-content); font-family: var(--font-sans, system-ui, sans-serif); }
  .__pv-label { position: sticky; top: 0; z-index: 50; background: #111; color: #fff; font: 600 12px/1 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; padding: 8px 16px; border-top: 2px solid #fff; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
  const out = join(scratchDir, `preview-${spec.slug}.html`);
  await fs.writeFile(out, html, 'utf8');
  return { path: out };
}
