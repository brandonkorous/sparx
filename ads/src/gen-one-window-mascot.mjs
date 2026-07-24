import fs from 'node:fs';
const EMBER='#e04631', INK='#0c1433', WHITE='#ffffff';
// Real wordmark geometry from packages/brand/src/marks.ts
const BODY=[
'M38.58,107.23c-6.46,0-12.22-1.14-17.13-3.72-8.39-4.41-12.41-12.72-14.66-19.27l14.94-.04c1.41,3,3.65,5.36,6.74,7.09,3.09,1.73,6.46,2.6,10.11,2.6,2.9,0,5.31-.65,7.23-1.96,1.92-1.31,2.88-3.14,2.88-5.48,0-2.06-.77-3.74-2.32-5.06-1.55-1.31-4.38-2.62-8.5-3.93l-6.18-1.68c-12.45-3.37-18.59-10.53-18.4-21.49,0-6.08,2.39-10.96,7.16-14.61,4.78-3.65,10.77-5.48,17.98-5.48,10.86,0,18.77,3.98,23.74,11.94l-12.95,5.47c-3.21-3.25-5.73-4.48-11.06-4.48-2.53,0-4.73.59-6.6,1.76-1.87,1.17-2.81,2.79-2.81,4.84,0,1.87.61,3.47,1.83,4.78,1.22,1.31,3.42,2.48,6.6,3.51l7.16,2.11c6.55,1.96,11.47,4.61,14.75,7.93,3.28,3.32,4.92,7.79,4.92,13.41,0,6.65-2.39,11.94-7.16,15.87-4.77,3.93-10.86,5.9-18.26,5.9Z',
'M95.46,135.17h-15.45V42.08l15.45-6.48v9.41c2.15-3,5.27-5.55,9.34-7.66,4.07-2.11,8.5-3.16,13.27-3.16,9.55,0,17.58,3.56,24.09,10.67,6.51,7.12,9.76,15.73,9.76,25.84s-3.25,18.73-9.76,25.84c-6.51,7.12-14.54,10.67-24.09,10.67-4.77,0-9.2-1.05-13.27-3.16-4.07-2.11-7.19-4.66-9.34-7.66v38.76ZM115.27,93.18c6.08,0,11.09-2.15,15.03-6.46,3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.24,2.15-15.17,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01c3.93,4.31,8.99,6.46,15.17,6.46Z',
'M196.44,107.23c-9.55,0-17.58-3.56-24.09-10.67-6.51-7.12-9.76-15.73-9.76-25.84s3.25-18.73,9.76-25.84c6.51-7.11,14.54-10.67,24.09-10.67,4.78,0,9.18,1.05,13.2,3.16,4.02,2.11,7.11,4.66,9.27,7.66v-2.93l15.45-6.48v70.22h-15.45v-9.41c-2.15,3-5.24,5.55-9.27,7.66-4.03,2.11-8.43,3.16-13.2,3.16ZM184.23,86.72c3.93,4.31,8.94,6.46,15.03,6.46s11.1-2.15,15.03-6.46c3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.1,2.15-15.03,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01Z',
'M255.29,105.82v-63.74l15.45-6.48v12.5c1.31-3.93,3.72-7.11,7.23-9.55,3.51-2.43,7.28-3.65,11.31-3.65,2.44,0,4.45.19,6.04.56v15.87c-2.25-.84-4.82-1.26-7.72-1.26-4.68,0-8.66,1.89-11.94,5.69-3.28,3.79-4.92,9.06-4.92,15.8v34.27h-15.45Z'];
const XP='M355.71,105.82l-18.96-23.74-18.96,23.74h-18.82l27.95-34.97-21.55-28.77,13.54-6.48,17.7,23.6,17.7-23.6h18.54l-26.4,35.25,27.95,34.97h-18.68Z';
const MBODY='M170.31,255.34l-109.82,99.37c-.57.51-1.42-.16-1.05-.83l67.83-124.24c10.46-19.16,6.65-42.98-9.28-57.92L40.35,98.9c-.53-.5,0-1.38.68-1.14l108.59,36.79c16.07,5.44,33.82,1.61,46.21-9.97l105.94-99.04c.56-.52,1.41.13,1.07.8l-62.08,122.72c-10.19,20.14-5.47,44.62,11.46,59.54l105.28,92.71c.58.51,0,1.43-.71,1.14l-136.62-55.85c-16.92-6.92-36.32-3.52-49.87,8.75Z';
// wordmark: body white, x ember (on navy)
const wordmark=(w)=>`<svg width="${w}" viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg">
  ${BODY.map(d=>`<path d="${d}" fill="${WHITE}"/>`).join('')}
  <path d="${XP}" fill="${EMBER}"/></svg>`;
// mascot: ember hollow spark + white eyes (read on navy)
const mascot=(w)=>`<svg width="${w}" viewBox="0 0 380.23 380.23" xmlns="http://www.w3.org/2000/svg">
  <path d="${MBODY}" fill="none" stroke="${EMBER}" stroke-width="28.34" stroke-linejoin="round" stroke-linecap="round"/>
  <ellipse cx="177.89" cy="176.24" rx="7.6" ry="12.4" fill="${WHITE}"/>
  <ellipse cx="201.14" cy="176.24" rx="7.6" ry="12.4" fill="${WHITE}"/>
  <path d="M175 198 Q189.5 217 204 198" fill="none" stroke="${WHITE}" stroke-width="6.5" stroke-linecap="round"/></svg>`;

const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#c9cede;font-family:"Segoe UI",system-ui,-apple-system,sans-serif}
.card{width:1200px;height:1200px;background:${INK};position:relative;overflow:hidden;padding:88px 90px}
.logo{position:relative;z-index:5}
.h1{position:absolute;left:90px;top:288px;z-index:5;font-weight:800;font-size:104px;line-height:.98;letter-spacing:-.03em;color:${WHITE}}
.h1 .em{color:${EMBER}}
.cta{position:absolute;left:90px;bottom:104px;z-index:6;display:flex;align-items:center;gap:34px}
.cta .lead{color:${WHITE};font-size:46px;font-weight:750;letter-spacing:-.01em}
.cta .arrow{display:flex;align-items:center}
.pill{background:${EMBER};color:${INK};font-size:40px;font-weight:750;padding:22px 46px;border-radius:999px;letter-spacing:-.01em}
.mascot{position:absolute;z-index:2}
</style></head><body>
<div class="card">
  <div class="logo">${wordmark(320)}</div>
  <div class="h1"><span class="em">Your whole<br>business,</span><br>in sync<br>on sparx.</div>
  <div class="mascot" style="right:-90px;top:300px;transform:rotate(-12deg)">${mascot(560)}</div>
  <div class="cta">
    <div class="lead">Start free</div>
    <div class="arrow"><svg width="150" height="34"><line x1="0" y1="17" x2="132" y2="17" stroke="${WHITE}" stroke-width="5"/><path d="M124 5 L142 17 L124 29" fill="none" stroke="${WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="pill">Get started</div>
  </div>
</div></body></html>`;
fs.writeFileSync('ad-1x1.html',html);
console.log('v11 written');
