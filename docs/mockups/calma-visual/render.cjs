const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const base = pathToFileURL(path.join(__dirname, 'index.html')).href;
  for (const [name, query] of [
    ['resumen-claro.png', '?screen=summary'],
    ['gastos-claro.png', '?screen=expenses'],
    ['resumen-oscuro.png', '?screen=summary&theme=dark'],
  ]) {
    await page.goto(base + query);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name) });
    console.log(name);
  }
  await browser.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
