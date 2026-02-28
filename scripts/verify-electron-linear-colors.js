const path = require('path');
const { _electron: electron } = require('playwright');

async function run() {
  const app = await electron.launch({
    args: [path.resolve('.')]
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => document.readyState === 'complete' && typeof renderIssueGraph === 'function',
      undefined,
      { timeout: 60000 }
    );
    await page.waitForSelector('.nav-btn[data-screen=\"build-chart\"]', { timeout: 30000 });
    await page.evaluate(() => {
      const navBtn = document.querySelector('.nav-btn[data-screen=\"build-chart\"]');
      if (!navBtn) {
        throw new Error('Build Chart nav button not found');
      }
      navBtn.click();
    });
    await page.waitForSelector('.screen-panel[data-screen-panel=\"build-chart\"].is-active', {
      timeout: 30000
    });
    await page.waitForSelector('#graph-load-mock', { timeout: 30000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('#graph-status');
      if (!el) return false;
      const text = (el.textContent || '').toLowerCase();
      return !text.includes('loading');
    });
    await page.evaluate(() => {
      const mockBtn = document.querySelector('#graph-load-mock');
      if (!mockBtn) {
        throw new Error('Load Mock Data button not found');
      }
      mockBtn.click();
    });
    await page.waitForFunction(() => {
      const el = document.querySelector('#graph-status');
      return Boolean(el && (el.textContent || '').toLowerCase().includes('mock issues'));
    });

    const graphStatus = ((await page.locator('#graph-status').textContent()) || '').trim();
    const graphMarkup = await page.locator('#graph-output').innerHTML();

    const expectedColors = ['#f2c94c', '#94a3b8', '#64748b'];
    const missing = expectedColors.filter((color) => !graphMarkup.toLowerCase().includes(color));

    await page.screenshot({
      path: path.resolve('electron-linear-state-colors-verification.png'),
      fullPage: true
    });

    if (missing.length > 0) {
      throw new Error(
        `Missing expected Linear state colors in rendered graph: ${missing.join(', ')} | status: ${graphStatus}`
      );
    }

    console.log(`PASS: Electron UI rendered mock graph with expected state colors. Status: ${graphStatus}`);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
