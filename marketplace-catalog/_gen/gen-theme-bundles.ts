// SCRATCH generator (not committed): turn the recovered SPARX_DATA_THEMES into
// marketplace-templates theme bundles + the HTML the asset renderer screenshots.
// Run: pnpm --filter @sparx/api-rest exec tsx marketplace-catalog/_gen/gen-theme-bundles.ts

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPARX_DATA_THEMES } from '../_src/themes';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = join(here, '..'); // marketplace-catalog/
const themesDir = join(catalog, 'themes');
const assetsDir = join(catalog, '_assets');

type V1 = (typeof SPARX_DATA_THEMES)[number]['preset']['v1']['light'];

function fontLink(...names: string[]): string {
  const fams = [...new Set(names)]
    .map((n) => `family=${n.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?${fams}&display=swap" rel="stylesheet">`
  );
}

function previewHtml(v: V1, name: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">${fontLink(v.fontHeading, v.fontBody)}<style>
*{margin:0;box-sizing:border-box}
html,body{width:1600px;height:1000px}
body{background:${v.colorBackground};color:${v.colorForeground};font-family:'${v.fontBody}',system-ui,sans-serif}
.wrap{height:1000px;display:flex;flex-direction:column}
.nav{display:flex;align-items:center;justify-content:space-between;padding:34px 72px;border-bottom:1px solid ${v.colorBorder}}
.brand{font-family:'${v.fontHeading}',Georgia,serif;font-size:36px;font-weight:700;letter-spacing:-.02em}
.navlinks{display:flex;gap:38px;align-items:center;font-size:19px;opacity:.82}
.btn{padding:15px 30px;border-radius:${v.radiusBase};font-weight:600;font-size:19px;border:1.5px solid transparent;font-family:'${v.fontBody}',system-ui,sans-serif}
.btn-primary{background:${v.colorPrimary};color:${v.colorPrimaryForeground}}
.btn-outline{background:transparent;color:${v.colorForeground};border-color:${v.colorBorder}}
.hero{padding:96px 72px 56px;display:flex;flex-direction:column;gap:30px;max-width:1180px}
h1{font-family:'${v.fontHeading}',Georgia,serif;font-size:82px;line-height:1.03;font-weight:700;letter-spacing:-.03em}
.sub{font-size:25px;line-height:1.5;opacity:.68;max-width:800px}
.cta{display:flex;gap:18px;margin-top:6px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;padding:18px 72px 0}
.card{background:${v.colorMuted};border:1px solid ${v.colorBorder};border-radius:${v.radiusBase};overflow:hidden}
.stripe{height:9px;background:${v.colorAccent}}
.cbody{padding:30px}
.cbody h3{font-family:'${v.fontHeading}',Georgia,serif;font-size:27px;margin-bottom:10px;font-weight:600}
.cbody p{font-size:18px;opacity:.6;line-height:1.5}
.swatches{display:flex;gap:16px;padding:46px 72px;margin-top:auto}
.sw{width:132px;height:66px;border-radius:${v.radiusBase};border:1px solid ${v.colorBorder}}
</style></head><body><div class="wrap">
<div class="nav"><div class="brand">${name}</div><div class="navlinks"><span>Shop</span><span>Collections</span><span>About</span><span class="btn btn-primary">Get started</span></div></div>
<div class="hero">
<h1>Design that feels like ${name}.</h1>
<div class="sub">A complete, considered look — typography, color, spacing, and shape — ready to apply to your whole site in a single click.</div>
<div class="cta"><span class="btn btn-primary">Primary action</span><span class="btn btn-outline">Secondary</span></div>
</div>
<div class="cards">
<div class="card"><div class="stripe"></div><div class="cbody"><h3>Considered type</h3><p>A heading and body pairing chosen to carry the brand's voice.</p></div></div>
<div class="card"><div class="stripe"></div><div class="cbody"><h3>Cohesive color</h3><p>One accent, balanced neutrals, and surfaces that hold together.</p></div></div>
<div class="card"><div class="stripe"></div><div class="cbody"><h3>Consistent shape</h3><p>Radius, border, and spacing tuned to a single, recognizable feel.</p></div></div>
</div>
<div class="swatches">
<div class="sw" style="background:${v.colorPrimary}"></div>
<div class="sw" style="background:${v.colorAccent}"></div>
<div class="sw" style="background:${v.colorForeground}"></div>
<div class="sw" style="background:${v.colorMuted}"></div>
<div class="sw" style="background:${v.colorBackground}"></div>
</div>
</div></body></html>`;
}

function iconHtml(v: V1, name: string): string {
  const initial = name.trim().slice(0, 1).toUpperCase();
  return `<!doctype html><html><head><meta charset="utf-8">${fontLink(v.fontHeading)}<style>
*{margin:0;box-sizing:border-box}
html,body{width:512px;height:512px}
.mark{width:512px;height:512px;background:${v.colorPrimary};display:flex;align-items:center;justify-content:center;position:relative}
.letter{font-family:'${v.fontHeading}',Georgia,serif;color:${v.colorPrimaryForeground};font-size:300px;font-weight:700;line-height:1}
.dot{position:absolute;right:60px;bottom:60px;width:76px;height:76px;border-radius:50%;background:${v.colorAccent}}
</style></head><body><div class="mark"><span class="letter">${initial}</span><span class="dot"></span></div></body></html>`;
}

async function main(): Promise<void> {
  await fs.mkdir(assetsDir, { recursive: true });
  const specs: { category: string; slug: string; previewHtml: string; iconHtml: string }[] = [];

  for (const t of SPARX_DATA_THEMES) {
    const dir = join(themesDir, t.slug);
    await fs.mkdir(join(dir, 'media'), { recursive: true });

    const sparx = {
      schemaVersion: 1,
      category: 'theme',
      slug: t.slug,
      name: t.name,
      version: '1.0.0',
      tagline: t.tagline,
      description: t.description,
      payload: 'theme.ts',
      facets: {
        mood: t.mood,
        colorFamily: t.colorFamily,
        density: t.density,
        industry: t.industry,
      },
      pricing: { model: 'free', priceCents: 0 },
      media: [
        { file: 'media/icon.png', kind: 'icon', alt: `${t.name} icon` },
        { file: 'media/preview.png', kind: 'preview', alt: `${t.name} theme preview` },
      ],
      author: { displayName: 'Sparx' },
      accent: t.accent,
      sortWeight: t.sortWeight,
    };
    await fs.writeFile(join(dir, 'sparx.json'), JSON.stringify(sparx, null, 2) + '\n');

    const themeTs =
      `// ${t.name} — a Sparx first-party marketplace theme (docs/85). The payload is a\n` +
      `// complete DataThemePreset (v1 storefront tokens + v2 preset); the ingest\n` +
      `// validates it and writes it to storage as the applied-at-runtime artifact.\n` +
      `export default ${JSON.stringify(t.preset, null, 2)};\n`;
    await fs.writeFile(join(dir, 'theme.ts'), themeTs);

    specs.push({
      category: 'themes',
      slug: t.slug,
      previewHtml: previewHtml(t.preset.v1.light, t.name),
      iconHtml: iconHtml(t.preset.v1.light, t.name),
    });
  }

  await fs.writeFile(join(assetsDir, 'themes.json'), JSON.stringify(specs, null, 2));
  console.log(`gen-theme-bundles: wrote ${specs.length} theme bundles + asset specs`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
