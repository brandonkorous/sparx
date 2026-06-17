/* Element-level screenshots: shoots each <section.hero> in the hero mockup as its
 * own clean PNG (no mockup-only label strips), plus a mobile commerce-saturated.
 */
const path = require('path');
const pwEntry = require.resolve('playwright', {
  paths: [path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.60.0', 'node_modules', 'playwright')],
});
const { chromium } = require(pwEntry);

const FILE = path.resolve(__dirname, 'hero-module-color.html');
const URL = 'file://' + FILE.replace(/\\/g, '/');

const NAMES = [
  'hero-commerce-saturated',
  'hero-commerce-tinted',
  'hero-cms-saturated',
  'hero-cms-tinted',
];

async function main() {
  const browser = await chromium.launch();

  // Desktop element shots for each variant
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const sections = await page.$$('section.hero');
  for (let i = 0; i < sections.length; i++) {
    const out = path.join(__dirname, `${NAMES[i]}-1440.png`);
    await sections[i].screenshot({ path: out });
    console.log('wrote', out);
  }
  await page.close();

  // Mobile commerce-saturated (390)
  const mob = await browser.newPage({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 2 });
  await mob.goto(URL, { waitUntil: 'networkidle' });
  await mob.waitForTimeout(500);
  const sec = (await mob.$$('section.hero'))[0];
  const out = path.join(__dirname, 'hero-commerce-saturated-390.png');
  await sec.screenshot({ path: out });
  console.log('wrote', out);
  await mob.close();

  await browser.close();
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
