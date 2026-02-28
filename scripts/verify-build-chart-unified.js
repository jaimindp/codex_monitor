const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron: electron } = require('playwright');

async function run() {
  const repoRoot = path.resolve('.');
  const app = await electron.launch({ args: [repoRoot] });

  const results = { checks: {}, metrics: {}, notes: [] };

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 60000 });

    await page.click('.nav-btn[data-screen="build-chart"]');
    await page.waitForSelector('.screen-panel[data-screen-panel="build-chart"].is-active', {
      timeout: 30000
    });

    results.checks.singleBuildChartCard =
      (await page.locator('main[data-screen-panel="build-chart"] .card').count()) === 1;
    results.checks.noSeparateDependencyCanvas = (await page.locator('#dep-map-output').count()) === 0;
    results.checks.noSeparateDependencyMapButton =
      (await page.locator('#graph-load-dependency-map').count()) === 0;

    await page.evaluate(() => {
      const panel = document.querySelector('#graph-controls-panel');
      if (panel) {
        panel.open = true;
      }
    });

    await page.click('#graph-load-mock');
    await page.waitForFunction(() => {
      const graph = document.querySelector('#graph-output svg');
      const graphText = (document.querySelector('#graph-output')?.textContent || '').toLowerCase();
      return Boolean(graph && graphText.includes('eng-101'));
    });

    const depMetrics = await page.evaluate(() => {
      const graphShell = document.querySelector('.graph-shell');
      const graphSection = document.querySelector('.graph-shell > section:first-child');
      const detailSection = document.querySelector('.graph-shell > section:last-child');
      const graphOutput = document.querySelector('#graph-output');
      const firstEdgePath = document.querySelector('#graph-output g.edgePaths path, #graph-output .path');
      const pathD = firstEdgePath ? firstEdgePath.getAttribute('d') || '' : '';

      return {
        shellWidth: graphShell ? Math.round(graphShell.getBoundingClientRect().width) : 0,
        graphSectionWidth: graphSection ? Math.round(graphSection.getBoundingClientRect().width) : 0,
        detailSectionWidth: detailSection ? Math.round(detailSection.getBoundingClientRect().width) : 0,
        graphClientWidth: graphOutput ? graphOutput.clientWidth : 0,
        graphScrollWidth: graphOutput ? graphOutput.scrollWidth : 0,
        edgePath: pathD
      };
    });

    results.metrics.graph = depMetrics;
    results.checks.detailsPaneHasRoom = depMetrics.detailSectionWidth >= 280;
    results.checks.graphFitsInitialViewport =
      depMetrics.graphScrollWidth <= depMetrics.graphClientWidth + 16;
    results.checks.edgesAreCurved = /[CQ]/.test(depMetrics.edgePath);

    const dependencyScreenshotPath = path.resolve('electron-build-chart-dependency-verification.png');
    await page.screenshot({ path: dependencyScreenshotPath, fullPage: true });
    results.dependencyScreenshot = dependencyScreenshotPath;

    const linearMetrics = await page.evaluate(() => {
      const detailSection = document.querySelector('.graph-shell > section:last-child');
      const graphOutput = document.querySelector('#graph-output');
      return {
        detailSectionWidth: detailSection ? Math.round(detailSection.getBoundingClientRect().width) : 0,
        graphClientWidth: graphOutput ? graphOutput.clientWidth : 0,
        graphScrollWidth: graphOutput ? graphOutput.scrollWidth : 0
      };
    });

    results.metrics.linear = linearMetrics;
    results.checks.linearGraphFitsInitialViewport =
      linearMetrics.graphScrollWidth <= linearMetrics.graphClientWidth + 16;

    const screenshotPath = path.resolve('electron-build-chart-unified-verification.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.screenshot = screenshotPath;

    const outputPath = path.resolve('electron-build-chart-unified-verification.json');
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ outputPath, results }, null, 2));

    const failed = Object.entries(results.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    if (failed.length) {
      throw new Error(`Verification failed checks: ${failed.join(', ')}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
