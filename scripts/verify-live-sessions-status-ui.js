const fs = require("node:fs/promises");
const path = require("node:path");
const { _electron: electron } = require("playwright");

async function run() {
  const repoRoot = path.resolve(".");
  const app = await electron.launch({ args: [repoRoot] });
  const results = {
    checks: {},
    status: {},
    artifacts: {}
  };

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 60000 });

    await page.click('.nav-btn[data-screen="usage"]');
    await page.waitForSelector('.screen-panel[data-screen-panel="usage"].is-active', { timeout: 15000 });
    await page.waitForFunction(() => {
      const btn = document.querySelector("#usage-refresh-btn");
      const select = document.querySelector("#usage-window-select");
      return Boolean(btn && select && !btn.disabled && !select.disabled);
    }, null, { timeout: 90000 });

    results.checks.liveSessionsListPresent = (await page.locator("#live-sessions-list").count()) === 1;
    results.checks.autoRefreshSelectPresent = (await page.locator("#usage-auto-refresh-select").count()) === 1;
    results.checks.liveRefreshLabelPresent = (await page.locator("#live-sessions-last-refresh").count()) === 1;

    const beforeRefreshLabel = ((await page.locator("#live-sessions-last-refresh").textContent()) || "").trim();
    await page.selectOption("#usage-auto-refresh-select", "5");

    await page.waitForFunction(
      (previousValue) => {
        const nextValue = (document.querySelector("#live-sessions-last-refresh")?.textContent || "").trim();
        return nextValue.length > 0 && nextValue !== previousValue;
      },
      beforeRefreshLabel,
      { timeout: 20000 }
    );

    const statusText = ((await page.locator("#usage-status").textContent()) || "").trim();
    const autoRefreshText = ((await page.locator("#usage-auto-refresh-status").textContent()) || "").trim();
    const afterRefreshLabel = ((await page.locator("#live-sessions-last-refresh").textContent()) || "").trim();
    const rowCount = await page.locator(".live-session-row").count();
    const chipCount = await page.locator(".live-session-chip").count();
    const invalidChipCount = await page
      .locator(
        '.live-session-chip:not(.state-active):not(.state-idle):not(.state-dead)'
      )
      .count();

    results.status.usageStatus = statusText;
    results.status.autoRefreshStatus = autoRefreshText;
    results.status.liveSessionsLastRefreshBefore = beforeRefreshLabel;
    results.status.liveSessionsLastRefreshAfter = afterRefreshLabel;
    results.status.rowCount = rowCount;
    results.status.chipCount = chipCount;

    results.checks.autoRefreshStatusSet = autoRefreshText.toLowerCase().includes("every 5s");
    results.checks.refreshLabelUpdated = beforeRefreshLabel !== afterRefreshLabel;
    results.checks.sessionRowsRender = rowCount > 0;
    results.checks.sessionChipsRender = chipCount > 0;
    results.checks.sessionChipStatesValid = invalidChipCount === 0;

    const screenshotPath = path.resolve("electron-live-sessions-status-verification.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.artifacts.screenshot = screenshotPath;

    const outputPath = path.resolve("electron-live-sessions-status-verification.json");
    await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
    results.artifacts.output = outputPath;

    console.log(JSON.stringify(results, null, 2));

    const failures = Object.entries(results.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    if (failures.length) {
      throw new Error(`Verification failed checks: ${failures.join(", ")}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
