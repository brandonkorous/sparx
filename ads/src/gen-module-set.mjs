import fs from 'node:fs';

// ── Brand geometry (from sparx/packages/brand/src/marks.ts) — never re-drawn by hand ──
const EMBER = '#e04631',
  INK = '#0c1433',
  WHITE = '#ffffff';

// Real wordmark geometry (sparx lockup). Body paths + the ember "x".
const BODY = [
  'M38.58,107.23c-6.46,0-12.22-1.14-17.13-3.72-8.39-4.41-12.41-12.72-14.66-19.27l14.94-.04c1.41,3,3.65,5.36,6.74,7.09,3.09,1.73,6.46,2.6,10.11,2.6,2.9,0,5.31-.65,7.23-1.96,1.92-1.31,2.88-3.14,2.88-5.48,0-2.06-.77-3.74-2.32-5.06-1.55-1.31-4.38-2.62-8.5-3.93l-6.18-1.68c-12.45-3.37-18.59-10.53-18.4-21.49,0-6.08,2.39-10.96,7.16-14.61,4.78-3.65,10.77-5.48,17.98-5.48,10.86,0,18.77,3.98,23.74,11.94l-12.95,5.47c-3.21-3.25-5.73-4.48-11.06-4.48-2.53,0-4.73.59-6.6,1.76-1.87,1.17-2.81,2.79-2.81,4.84,0,1.87.61,3.47,1.83,4.78,1.22,1.31,3.42,2.48,6.6,3.51l7.16,2.11c6.55,1.96,11.47,4.61,14.75,7.93,3.28,3.32,4.92,7.79,4.92,13.41,0,6.65-2.39,11.94-7.16,15.87-4.77,3.93-10.86,5.9-18.26,5.9Z',
  'M95.46,135.17h-15.45V42.08l15.45-6.48v9.41c2.15-3,5.27-5.55,9.34-7.66,4.07-2.11,8.5-3.16,13.27-3.16,9.55,0,17.58,3.56,24.09,10.67,6.51,7.12,9.76,15.73,9.76,25.84s-3.25,18.73-9.76,25.84c-6.51,7.12-14.54,10.67-24.09,10.67-4.77,0-9.2-1.05-13.27-3.16-4.07-2.11-7.19-4.66-9.34-7.66v38.76ZM115.27,93.18c6.08,0,11.09-2.15,15.03-6.46,3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.24,2.15-15.17,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01c3.93,4.31,8.99,6.46,15.17,6.46Z',
  'M196.44,107.23c-9.55,0-17.58-3.56-24.09-10.67-6.51-7.12-9.76-15.73-9.76-25.84s3.25-18.73,9.76-25.84c6.51-7.11,14.54-10.67,24.09-10.67,4.78,0,9.18,1.05,13.2,3.16,4.02,2.11,7.11,4.66,9.27,7.66v-2.93l15.45-6.48v70.22h-15.45v-9.41c-2.15,3-5.24,5.55-9.27,7.66-4.03,2.11-8.43,3.16-13.2,3.16ZM184.23,86.72c3.93,4.31,8.94,6.46,15.03,6.46s11.1-2.15,15.03-6.46c3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.1,2.15-15.03,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01Z',
  'M255.29,105.82v-63.74l15.45-6.48v12.5c1.31-3.93,3.72-7.11,7.23-9.55,3.51-2.43,7.28-3.65,11.31-3.65,2.44,0,4.45.19,6.04.56v15.87c-2.25-.84-4.82-1.26-7.72-1.26-4.68,0-8.66,1.89-11.94,5.69-3.28,3.79-4.92,9.06-4.92,15.8v34.27h-15.45Z',
];
const XP =
  'M355.71,105.82l-18.96-23.74-18.96,23.74h-18.82l27.95-34.97-21.55-28.77,13.54-6.48,17.7,23.6,17.7-23.6h18.54l-26.4,35.25,27.95,34.97h-18.68Z';

// The wordmark "x" is ALWAYS ember — it is the master brand mark, not a module hue.
const wordmark = (w) => `<svg width="${w}" viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg">
  ${BODY.map((d) => `<path d="${d}" fill="${WHITE}"/>`).join('')}
  <path d="${XP}" fill="${EMBER}"/></svg>`;

const arrow = `<svg width="150" height="34"><line x1="0" y1="17" x2="132" y2="17" stroke="${WHITE}" stroke-width="5"/><path d="M124 5 L142 17 L124 29" fill="none" stroke="${WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── On-navy legibility ────────────────────────────────────────────────────────
// The module tokens are SOLID-FILL hues; on the ink-navy field the darker ones
// (builder indigo, b2b slate, chat violet, invoicing lime, social blue) fall below
// readable contrast. We lift each hue toward white — same hue family, just bright
// enough — until its relative luminance clears a comfortable margin. That lifted
// tint paints BOTH the accent headline and the pill fill; the pill ink stays navy,
// exactly like the master creative's ember pill. Bright hues pass untouched.
const srgbToLin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const parseHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex) => {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
};
const mixWhite = (hex, t) => {
  const [r, g, b] = parseHex(hex);
  const m = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
};
// Target luminance ~0.22 → well past the ~0.14 large-text floor on navy, so the
// display type and the navy pill ink both read clearly. Cap the lift so a hue is
// never washed to pastel.
const accentOnNavy = (hex) => {
  let t = 0;
  let out = hex;
  while (luminance(out) < 0.22 && t < 0.6) {
    t += 0.06;
    out = mixWhite(hex, t);
  }
  return out;
};

// ── The 13 modules (wizeworks/packages/modules/src/index.ts ALL_MODULES) ────────────────
// hue  = --color-module-<slug> (theme.css / MODULE_HEX). accentOnNavy() lifts it
//        to a legible on-navy tint that paints both the accent line and the pill.
// em   = the hook line(s), painted in the (lifted) module hue
// body = grounding line(s), white
// A senior-marketing rewrite each: the module's actual promise, benefit-first,
// jargon-free (the audience is non-technical owners). Lines stay short so the
// display type reads at a glance and never crowds the frame.
const MODULES = [
  { key: 'builder', hue: '#4f46e5', em: ['Your site,', 'live today.'], body: ['No code.', 'Just sparx.'], pill: 'Build your site' },
  { key: 'commerce', hue: '#f97316', em: ['Start selling', 'this weekend.'], body: ['Your store,', 'on sparx.'], pill: 'Start selling' },
  { key: 'cms', hue: '#14b8a6', em: ['Publish it', 'everywhere.'], body: ['One library,', 'on sparx.'], pill: 'Start writing' },
  { key: 'crm', hue: '#06b6d4', em: ['Never lose', 'a customer.'], body: ['Every deal,', 'on sparx.'], pill: 'See your pipeline' },
  { key: 'email', hue: '#0ea5e9', em: ['Emails they', 'actually open.'], body: ['Timed right,', 'on sparx.'], pill: 'Send your first' },
  { key: 'b2b', hue: '#475569', em: ['Wholesale that', 'runs itself.'], body: ['Terms & tiers,', 'on sparx.'], pill: 'Open your portal' },
  { key: 'invoicing', hue: '#4d7c0f', em: ['Get paid,', 'no chasing.'], body: ['We chase it,', 'not you.'], pill: 'Send an invoice' },
  { key: 'dropship', hue: '#10b981', em: ['Sell it before', 'you stock it.'], body: ['Straight to', 'the door.'], pill: 'Start dropshipping' },
  { key: 'inventory', hue: '#f59e0b', em: ['Never oversell', 'again.'], body: ['Every unit,', 'counted live.'], pill: 'Track your stock' },
  { key: 'chat', hue: '#7c3aed', em: ['Answer fast,', 'every time.'], body: ['One inbox,', 'on sparx.'], pill: 'Turn on chat' },
  { key: 'ai', hue: '#db2777', em: ['Your AI,', 'your data.'], body: ['Wired up', 'by sparx.'], pill: 'Connect your AI' },
  { key: 'scheduling', hue: '#e11d48', em: ['Booked solid.', 'No phone tag.'], body: ['Appointments', 'on sparx.'], pill: 'Take bookings' },
  { key: 'social', hue: '#2563eb', em: ['Post once,', 'reach all.'], body: ['Every channel,', 'on sparx.'], pill: 'Start posting' },
];

// One 1200-space card, wrapped in a 1092 export frame (scale 0.91) so the PNG is
// ── Aspect ratios ─────────────────────────────────────────────────────────────
// One folder per ratio, each with a TUNED layout — not a stretched square. Type
// scales up in the tall formats; the story format keeps the headline + CTA inside
// the platform UI safe zones (big top/bottom padding). The layout is a flex column
// (logo pinned top, CTA pinned bottom, headline in the middle band) so it adapts
// cleanly to any canvas. `pad` is a full CSS `T R B L`; `just` places the headline
// within the middle band. `wm/hf/lead/pill` are px sizes for this ratio.
const RATIOS = [
  { key: '1x1', w: 1080, h: 1080, pad: '78 84 84 84', wm: 300, hf: 96, lh: 0.98, lead: 40, pill: 38, ppad: '20 44', gap: 30, just: 'flex-start', mt: 96 },
  { key: '4x5', w: 1080, h: 1350, pad: '90 84 96 84', wm: 300, hf: 104, lh: 0.98, lead: 42, pill: 40, ppad: '22 46', gap: 32, just: 'center', mt: 0 },
  { key: '9x16', w: 1080, h: 1920, pad: '150 88 300 88', wm: 330, hf: 120, lh: 0.98, lead: 48, pill: 46, ppad: '26 54', gap: 34, just: 'center', mt: 0 },
  { key: '16x9', w: 1920, h: 1080, pad: '92 110 96 110', wm: 320, hf: 112, lh: 0.98, lead: 46, pill: 42, ppad: '24 50', gap: 34, just: 'center', mt: 0 },
  { key: '1.91x1', w: 1200, h: 628, pad: '52 66 56 66', wm: 224, hf: 74, lh: 0.96, lead: 32, pill: 30, ppad: '16 34', gap: 22, just: 'center', mt: 0 },
];

// Multi-value CSS lengths (padding shorthands) need a unit on EVERY token — a bare
// `92 110 96 110` is invalid and silently dropped, collapsing to zero padding.
const px = (s) => s.split(' ').map((n) => `${n}px`).join(' ');

const cardHtml = (m, r) => {
  const acc = accentOnNavy(m.hue);
  const head = `${m.em.map((l) => `<span style="color:${acc}">${l}</span>`).join('<br>')}<br>${m.body
    .map((l) => `<span>${l}</span>`)
    .join('<br>')}`;
  const bodyStyle = `justify-content:${r.just}${r.just === 'flex-start' ? `;padding-top:${r.mt}px` : ''}`;
  return `
<div class="frame" style="width:${r.w}px;height:${r.h}px" data-out="modules/${r.key}/sparx-ad-module-${m.key}-${r.key}.png">
  <div class="card" style="padding:${px(r.pad)}">
    <div class="logo">${wordmark(r.wm)}</div>
    <div class="body" style="${bodyStyle}">
      <div class="h1" style="font-size:${r.hf}px;line-height:${r.lh}">${head}</div>
    </div>
    <div class="cta" style="gap:${r.gap}px">
      <div class="lead" style="font-size:${r.lead}px">Start free</div>
      <div class="arrow">${arrow}</div>
      <div class="pill" style="background:${acc};color:${INK};font-size:${r.pill}px;padding:${px(r.ppad)}">${m.pill}</div>
    </div>
  </div>
</div>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#c9cede;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;display:flex;flex-wrap:wrap;gap:24px;padding:24px}
.frame{overflow:hidden;flex:0 0 auto}
.card{width:100%;height:100%;background:${INK};display:flex;flex-direction:column}
.logo{flex:0 0 auto}
.body{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}
.h1{font-weight:800;letter-spacing:-.03em;color:${WHITE}}
.cta{flex:0 0 auto;display:flex;align-items:center;gap:34px}
.cta .lead{color:${WHITE};font-weight:750;letter-spacing:-.01em}
.cta .arrow{display:flex;align-items:center;flex:0 0 auto}
.pill{font-weight:750;border-radius:999px;letter-spacing:-.01em;white-space:nowrap}
</style></head><body>
${RATIOS.map((r) => MODULES.map((m) => cardHtml(m, r)).join('')).join('')}
</body></html>`;

fs.writeFileSync('module-set.html', html);
console.log(`wrote module-set.html — ${MODULES.length} modules × ${RATIOS.length} ratios = ${MODULES.length * RATIOS.length} cards`);
