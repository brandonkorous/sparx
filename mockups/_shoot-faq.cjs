/* Element screenshots for the three FAQ directions + a mobile of the strongest. */
const path = require('path');
const pwEntry = require.resolve('playwright', {
  paths: [path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.60.0', 'node_modules', 'playwright')],
});
const { chromium } = require(pwEntry);

const FILE = path.resolve(__dirname, 'faq-redesign.html');
const URL = 'file://' + FILE.replace(/\\/g, '/');
const NAMES = ['faq-accordion', 'faq-editorial-qa', 'faq-index-spread'];

async function main() {
  const browser = await chromium.launch();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const sections = await page.$$('section.section');
  for (let i = 0; i < sections.length; i++) {
    const out = path.join(__dirname, `${NAMES[i]}-1440.png`);
    await sections[i].screenshot({ path: out });
    console.log('wrote', out);
  }
  await page.close();

  // Mobile of A (accordion) and C (spread)
  for (const [idx, nm] of [[0, 'faq-accordion'], [2, 'faq-index-spread']]) {
    const mob = await browser.newPage({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 2 });
    await mob.goto(URL, { waitUntil: 'networkidle' });
    await mob.waitForTimeout(400);
    const sec = (await mob.$$('section.section'))[idx];
    const out = path.join(__dirname, `${nm}-390.png`);
    await sec.screenshot({ path: out });
    console.log('wrote', out);
    await mob.close();
  }

  await browser.close();
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
