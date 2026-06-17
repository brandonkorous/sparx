/* Screenshot helper for marketing-designer mockups.
 * Usage: node mockups/_shoot.cjs <file.html> <name> <w1> [w2] [w3] ...
 * Renders the mockup at each width (full-page) and writes mockups/<name>-<w>.png.
 */
const path = require('path');
const pwEntry = require.resolve('playwright', {
  paths: [path.join(__dirname, '..', 'node_modules', '.pnpm', 'playwright@1.60.0', 'node_modules', 'playwright')],
});
const { chromium } = require(pwEntry);

async function main() {
  const [, , file, name, ...widthArgs] = process.argv;
  if (!file || !name || widthArgs.length === 0) {
    console.error('args: <file.html> <name> <w...>');
    process.exit(1);
  }
  const widths = widthArgs.map(Number);
  const abs = path.resolve(file);
  const url = 'file://' + abs.replace(/\\/g, '/');
  const browser = await chromium.launch();
  for (const w of widths) {
    const page = await browser.newPage({
      viewport: { width: w, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    // give web fonts a beat to settle
    await page.waitForTimeout(500);
    const out = path.join(__dirname, `${name}-${w}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log('wrote', out);
    await page.close();
  }
  await browser.close();
}
main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
