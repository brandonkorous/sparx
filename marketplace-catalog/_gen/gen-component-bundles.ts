// SCRATCH generator (not committed): turn the recovered SPARX_DATA_COMPONENTS into
// marketplace component bundles + the HTML the asset renderer screenshots.
//
// The blocks are class-first (seedNode compiles box/layout → a Tailwind class
// string with container-query variants). The preview interprets that class string
// deterministically — container variants (@3xl:, @4xl:) are treated as ALWAYS-on
// because the preview canvas is desktop-wide — plus type-specific leaf styling.
// Run: pnpm --filter @sparx/api-rest exec tsx marketplace-catalog/_gen/gen-component-bundles.ts

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPARX_DATA_COMPONENTS } from '../_src/components';

type Node = {
  type: string;
  class?: string;
  props?: Record<string, unknown>;
  children?: Node[];
};
type Prop = { key: string; default?: string };

const here = dirname(fileURLToPath(import.meta.url));
const catalog = join(here, '..');
const dirOf = join(catalog, 'components');
const assetsDir = join(catalog, '_assets');

const ACCENT = '#14b8a6';
const FONT_HEAD = 'Plus Jakarta Sans';
const FONT_BODY = 'Inter';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function fontLink(): string {
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=${FONT_HEAD.replace(/ /g, '+')}:wght@500;600;700;800&family=${FONT_BODY.replace(/ /g, '+')}:wght@400;500;600&display=swap" rel="stylesheet">`
  );
}

// Class → inline style. Container-query variants (@*:) are stripped so they apply
// unconditionally (the preview is wide). Later classes win, matching the source
// order "p-8 @3xl:p-16" / "grid-cols-1 @4xl:grid-cols-4".
function styleFromClass(cls: string | undefined): string {
  const s: Record<string, string> = {};
  for (let c of (cls ?? '').split(/\s+/)) {
    if (!c) continue;
    c = c.replace(/^@[^:]+:/, '');
    if (c === 'flex') s.display = 'flex';
    else if (c === 'grid') s.display = 'grid';
    else if (c === 'flex-col') s['flex-direction'] = 'column';
    else if (c === 'flex-row') s['flex-direction'] = 'row';
    else if (c === 'mx-auto') {
      s['margin-left'] = 'auto';
      s['margin-right'] = 'auto';
    } else if (c === 'w-full') s.width = '100%';
    else if (c === 'max-w-site') s['max-width'] = '1240px';
    else if (c === 'text-center') s['text-align'] = 'center';
    else if (c === 'text-white' || c === 'text-neutral-content') s.color = '#eef2f6';
    else if (c === 'bg-base-200') s.background = '#f1f5f9';
    else if (c === 'bg-neutral') s.background = '#1f2937';
    else if (c === 'items-center') s['align-items'] = 'center';
    else if (c === 'items-start') s['align-items'] = 'flex-start';
    else if (c === 'justify-center') s['justify-content'] = 'center';
    else {
      let m: RegExpMatchArray | null;
      if ((m = c.match(/^gap-(\d+)$/))) s.gap = +m[1] * 4 + 'px';
      else if ((m = c.match(/^p-(\d+)$/))) s.padding = +m[1] * 4 + 'px';
      else if ((m = c.match(/^px-(\d+)$/))) {
        s['padding-left'] = s['padding-right'] = +m[1] * 4 + 'px';
      } else if ((m = c.match(/^py-(\d+)$/))) {
        s['padding-top'] = s['padding-bottom'] = +m[1] * 4 + 'px';
      } else if ((m = c.match(/^grid-cols-(\d+)$/))) {
        s['grid-template-columns'] = `repeat(${m[1]},minmax(0,1fr))`;
      } else if ((m = c.match(/^min-h-\[([^\]]+)\]$/))) s['min-height'] = m[1];
    }
  }
  return Object.entries(s)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function resolve(v: unknown, props: Map<string, string>): string {
  if (v && typeof v === 'object' && '$prop' in (v as object)) {
    return props.get((v as { $prop: string }).$prop) ?? '';
  }
  return String(v ?? '');
}

function render(node: Node, props: Map<string, string>): string {
  const base = styleFromClass(node.class);
  const p = node.props ?? {};
  const kids = (node.children ?? []).map((c) => render(c, props)).join('');

  switch (node.type) {
    case 'Section': {
      // A background image becomes a dark gradient placeholder (self-contained, no
      // external fetch) — the section already carries text-white in that case.
      const bg = p.bgImage ? 'background:linear-gradient(135deg,#0f172a,#334155);' : '';
      return `<section style="position:relative;${base};${bg}">${kids}</section>`;
    }
    case 'Card':
      return `<div style="${base};border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,.05)">${kids}</div>`;
    case 'Stack':
    case 'Grid':
      return `<div style="${base}">${kids}</div>`;
    case 'Heading': {
      const lv = (p.level as string) ?? 'h2';
      const size = lv === 'h1' ? 64 : lv === 'h2' ? 42 : 23;
      return `<${lv} style="${base};font-family:'${FONT_HEAD}',system-ui,sans-serif;font-weight:${lv === 'h3' ? 600 : 800};font-size:${size}px;line-height:1.1;letter-spacing:-.02em;margin:0">${esc(resolve(p.text, props))}</${lv}>`;
    }
    case 'Text': {
      const meta = p.variant === 'meta';
      return `<p style="${base};font-family:'${FONT_BODY}',system-ui,sans-serif;margin:0;${meta ? 'font-size:14px;letter-spacing:.07em;text-transform:uppercase;opacity:.6;font-weight:600' : 'font-size:20px;line-height:1.5;opacity:.74'}">${esc(resolve(p.text, props))}</p>`;
    }
    case 'Button': {
      const soft = p.style === 'soft';
      return `<a style="${base};display:inline-block;text-decoration:none;font-family:'${FONT_BODY}',sans-serif;font-weight:600;font-size:18px;padding:14px 30px;border-radius:10px;background:${soft ? '#eef2ff' : '#6366f1'};color:${soft ? '#4338ca' : '#fff'}">${esc(resolve(p.label, props))}</a>`;
    }
    case 'Image':
      // width:100% (not flex:1) so it shrinks equally beside a w-full Stack → 50/50.
      return `<div style="${base};${/min-height/.test(base) ? '' : 'min-height:320px;'}width:100%;border-radius:14px;background:linear-gradient(135deg,#e7ecf3,#cbd5e1);border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
    case 'Stat':
      return `<div style="${base};text-align:center"><div style="font-family:'${FONT_HEAD}',sans-serif;font-weight:800;font-size:50px;line-height:1">${esc(p.value)}</div><div style="font-family:'${FONT_BODY}',sans-serif;font-size:16px;opacity:.65;margin-top:6px">${esc(p.label)}</div></div>`;
    case 'Signup':
      return `<div style="display:flex;gap:12px;margin-top:8px"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:15px 20px;width:300px;color:#94a3b8;font-family:'${FONT_BODY}',sans-serif;font-size:17px">you@example.com</div><a style="background:#6366f1;color:#fff;padding:15px 28px;border-radius:10px;font-family:'${FONT_BODY}',sans-serif;font-weight:600;font-size:17px">${esc(p.cta ?? 'Subscribe')}</a></div>`;
    default:
      return kids;
  }
}

function previewHtml(tree: Node, propSpec: Prop[], name: string): string {
  const props = new Map(propSpec.map((p) => [p.key, p.default ?? p.key]));
  return `<!doctype html><html><head><meta charset="utf-8">${fontLink()}<style>*{box-sizing:border-box}html,body{margin:0;width:1600px;height:1000px}body{background:#fff;display:flex;align-items:center;color:#0f172a;font-family:'${FONT_BODY}',system-ui,sans-serif}.frame{width:1600px}.frame>section{width:100%}</style></head><body><div class="frame" aria-label="${esc(name)}">${render(tree, props)}</div></body></html>`;
}

function glyph(tree: Node): string {
  const cls = tree.class ?? '';
  const cell = (x: number, y: number, w: number, h: number): string =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffffff" opacity=".95"/>`;
  if (/flex-row/.test(cls)) return cell(96, 150, 150, 212) + cell(266, 150, 150, 212);
  const gm = cls.match(/grid-cols-(\d+)/g);
  if (/grid/.test(cls) && gm) {
    const n = Math.min(Number(gm[gm.length - 1].replace(/\D/g, '')) || 3, 4);
    const gap = 20;
    const w = (320 - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => cell(96 + i * (w + gap), 180, w, 152)).join('');
  }
  return cell(96, 150, 320, 40) + cell(96, 210, 240, 28) + cell(96, 262, 150, 52);
}

function iconHtml(tree: Node): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:512px;height:512px}</style></head><body><svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="${ACCENT}"/>${glyph(tree)}</svg></body></html>`;
}

async function main(): Promise<void> {
  await fs.mkdir(assetsDir, { recursive: true });
  const specs: { category: string; slug: string; previewHtml: string; iconHtml: string }[] = [];

  for (const c of SPARX_DATA_COMPONENTS) {
    const dir = join(dirOf, c.slug);
    await fs.mkdir(join(dir, 'media'), { recursive: true });

    const sparx = {
      schemaVersion: 1,
      category: 'component',
      slug: c.slug,
      name: c.name,
      version: '1.0.0',
      tagline: c.tagline,
      description: c.description,
      payload: 'component.tsx',
      facets: { group: c.group, kind: c.kind, surfaces: c.surfaces },
      pricing: { model: 'free', priceCents: 0 },
      media: [
        { file: 'media/icon.png', kind: 'icon', alt: `${c.name} icon` },
        { file: 'media/preview.png', kind: 'preview', alt: `${c.name} preview` },
      ],
      author: { displayName: 'Sparx' },
      accent: ACCENT,
      sortWeight: c.sortWeight,
    };
    await fs.writeFile(join(dir, 'sparx.json'), JSON.stringify(sparx, null, 2) + '\n');

    const payload = { tree: c.tree, propSpec: c.propSpec };
    const tsx =
      `// ${c.name} — a Sparx first-party marketplace component (docs/85). The payload is\n` +
      `// a composed builder node-tree + propSpec; the ingest validates it and writes it\n` +
      `// to storage as the artifact "Add" clones into a tenant's component library.\n` +
      `export default ${JSON.stringify(payload, null, 2)};\n`;
    await fs.writeFile(join(dir, 'component.tsx'), tsx);

    specs.push({
      category: 'components',
      slug: c.slug,
      previewHtml: previewHtml(c.tree as Node, c.propSpec, c.name),
      iconHtml: iconHtml(c.tree as Node),
    });
  }

  await fs.writeFile(join(assetsDir, 'components.json'), JSON.stringify(specs, null, 2));
  console.log(`gen-component-bundles: wrote ${specs.length} component bundles + asset specs`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
