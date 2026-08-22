// PREVIEW machinery for the booking-backed service templates — the review aid + the
// source the media screenshotter shoots (NOT the shipped payload). `writeServicePreview`
// renders ONE template's HOME page, in its real frame + bespoke theme, to a self-contained
// HTML file in `.preview/`, exactly as the storefront renders it — so it can be eyeballed
// and screenshotted into `media/preview.png`. A lean sibling of template-sites/preview.ts
// (no commerce/content sample host — a service site's home is static content + the pinned
// scheduling core, which is placeholderized).
//
// WHY RELATIVE IMPORTS — see harness.ts (marketplace-catalog has no node_modules).

import { execFileSync } from 'node:child_process';
import { promises as fs, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  el,
  type Node,
  type Theme,
} from '../../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { renderSilicaBody } from '../../../wizeworks/packages/silica-catalog/src/render';
import {
  createSilicaResolver,
  defaultSilicaFormat,
} from '../../../wizeworks/packages/builder-schemas/src/silica-resolve';
import { buildSilicaThemeCssFromTheme } from '../../../wizeworks/packages/site-themes/src/v2/silica-css';

import { composeServiceSite, faces, type ServiceSiteSpec } from './harness';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/** The STANDARD preview dir (gitignored) every service template's preview HTML + screenshot
 *  lands in. `media-service.mjs` reads `preview-<key>.html` from here. */
export const PREVIEW_DIR = join(here, '..', '.preview');

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

/** WHERE the Tailwind entry has to live. The `@import`/`@source` paths in the input CSS
 *  below are relative to THIS directory, and the compile needs a package that resolves
 *  `tailwindcss` + the silicaui plugin — so it is a real workspace location, not a scratch
 *  dir, and it cannot be quietly wrong. It has been quietly wrong twice: `@tailwindcss/cli`
 *  left the workspace with `packages/site-ui`, and then `apps/site` moved under
 *  `wizeworks/` and every service preview began throwing ENOENT part-way through a
 *  generate — after the bundle was already written, so the run LOOKED like it worked.
 *  Assert it, and say what to change when the tree moves again. */
const SITE_APP_DIR = join(repoRoot, 'wizeworks', 'apps', 'site');

function previewCssEntry(slug: string): string {
  if (!existsSync(SITE_APP_DIR)) {
    throw new Error(
      `Preview CSS needs the site app at ${SITE_APP_DIR} — it is the package that resolves ` +
        `tailwindcss and @wizeworks/silicaui. That directory does not exist. If the app has ` +
        `moved, update SITE_APP_DIR and the '../../packages/silica-catalog/...' paths below, ` +
        `which are resolved relative to it.`
    );
  }
  return join(SITE_APP_DIR, `_preview-${slug}.css`);
}

/** Compile exactly the Tailwind + silicaui CSS the rendered markup needs (reuses the shared
 *  tailwind-compile.mjs child process, keyed by slug so parallel runs can't collide). */
function compilePreviewCss(slug: string, bodyHtml: string, scratchDir: string): string {
  const bodyPath = join(scratchDir, `preview-${slug}.body.html`);
  const inputPath = previewCssEntry(slug);
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

/** Swap the frame's LIVE host cores (brand / theme toggle / legal links) for static
 *  stand-ins so the preview chrome reads like the storefront. Preview-only. */
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
    n.children = n.children
      .map((c) => staticizeHostNodes(c, brandName))
      .filter((c) => c !== null);
  }
  return node;
}

/** Replace the LIVE scheduling core (a server-computed host node a static `toHtml` renders
 *  as an empty mount) with a labeled placeholder, so the preview reads "the live booking
 *  widget renders here". The bespoke masthead above it renders normally. Preview-only. */
function placeholderizeCores(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n.kind === 'host') {
    const key = n.component ?? 'core';
    return el(
      'div',
      'mx-auto my-8 w-full max-w-3xl rounded-box border border-dashed border-base-300 bg-base-200 px-6 py-16 text-center text-base-content',
      { text: `▦ live "${key}" booking widget renders here on the storefront` }
    );
  }
  if (Array.isArray(n.children)) {
    n.children = n.children.map((c) => placeholderizeCores(c));
  }
  return node;
}

export interface WriteServicePreviewResult {
  path: string;
}

/**
 * Render ALL of ONE service template's pages — Home in its real frame, then Book, About and
 * Contact under a label banner — in the bundle's bespoke theme, to a self-contained HTML file
 * in `scratchDir`, exactly as the storefront renders them. The pinned scheduling core shows a
 * labeled placeholder (it renders server-side live).
 *
 * WHY EVERY PAGE. This rendered only `pages[0]` until 2026-08-12, which meant the Book, About
 * and Contact pages of NINETY-SEVEN shipped bundles — over half the catalogue — had never been
 * looked at, while the template and portfolio harnesses next door had always stacked their
 * whole site. A starter site is judged as a site; previewing one page of four graded the part
 * that was easiest to see. `media-service.mjs` shoots `media/preview.png` from the top of this
 * file, so the home-page screenshot it captures is unchanged.
 */
export async function writeServicePreview(
  spec: ServiceSiteSpec,
  theme: Theme,
  scratchDir: string = PREVIEW_DIR
): Promise<WriteServicePreviewResult> {
  await fs.mkdir(scratchDir, { recursive: true });
  const site = composeServiceSite(spec);
  const pages = site.pages as { name: string; root: Node }[];
  const frameRoot = staticizeHostNodes(
    (site.frame as { root: Node }).root,
    spec.brand.businessName
  ) as Node;

  // A minimal resolver host — a service page binds nothing but the site identity.
  const host = createSilicaResolver({
    root: { site: { identity: { name: spec.brand.businessName } } },
    format: defaultSilicaFormat,
  });

  // Deep-clone each root before placeholderizing so the mutation can't leak into the bundle.
  const clone = (n: Node): Node => JSON.parse(JSON.stringify(n)) as Node;
  const label = (name: string): string => `<div class="__pv-label">${name}</div>`;
  const renderPage = (root: Node, framed: boolean): string =>
    renderSilicaBody(placeholderizeCores(clone(root)) as Node, {
      host,
      ...(framed ? { frame: frameRoot } : {}),
      html: { ids: false },
    });

  const parts: string[] = [renderPage(pages[0]!.root, true)];
  for (const pg of pages.slice(1)) {
    parts.push(label(pg.name));
    parts.push(renderPage(pg.root, false));
  }
  const bodyHtml = parts.join('\n');

  const utilCss = compilePreviewCss(spec.key, bodyHtml, scratchDir);
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
  const out = join(scratchDir, `preview-${spec.key}.html`);
  await fs.writeFile(out, html, 'utf8');
  return { path: out };
}
