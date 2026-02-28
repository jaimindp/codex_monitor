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

    await page.click('.nav-btn[data-screen="agents"]');
    await page.waitForSelector('.screen-panel[data-screen-panel="agents"].is-active', {
      timeout: 15000
    });

    if ((await page.locator("#agent-dry-run").count()) === 1) {
      await page.check("#agent-dry-run");
    }

    await page.click('.nav-btn[data-screen="build-chart"]');
    await page.waitForSelector('.screen-panel[data-screen-panel="build-chart"].is-active', {
      timeout: 15000
    });

    await page.evaluate(() => {
      const controlsPanel = document.querySelector("#graph-controls-panel");
      if (controlsPanel) {
        controlsPanel.open = true;
      }
    });

    await page.click("#graph-load-mock");
    await page.waitForFunction(() => {
      const graph = document.querySelector("#graph-output svg");
      const graphText = (document.querySelector("#graph-output")?.textContent || "").toLowerCase();
      return Boolean(graph && graphText.includes("eng-101"));
    }, null, { timeout: 30000 });

    await page.locator("#graph-output .node").first().click();
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-action="deploy-orchestrator"]')),
      null,
      { timeout: 15000 }
    );
    await page.evaluate(() => {
      const deployButton = document.querySelector('[data-action="deploy-orchestrator"]');
      if (!deployButton) {
        throw new Error("deploy button missing from graph details");
      }
      deployButton.click();
    });

    await page.waitForSelector('.screen-panel[data-screen-panel="agents"].is-active', {
      timeout: 15000
    });

    results.checks.controlsPresent =
      (await page.locator("#agent-task-id").count()) === 1 &&
      (await page.locator("#agent-task-title").count()) === 1 &&
      (await page.locator("#agent-ticket-brief").count()) === 1 &&
      (await page.locator("#agent-start-run").count()) === 1;

    await page.waitForFunction(() => {
      const status = (document.querySelector("#agent-status")?.textContent || "").toLowerCase();
      return status.includes("completed") || status.includes("failed") || status.includes("stopped");
    }, null, { timeout: 120000 });

    const statusText = ((await page.locator("#agent-status").textContent()) || "").trim();
    const metaText = ((await page.locator("#agent-run-meta").textContent()) || "").trim();
    const logsText = ((await page.locator("#agent-logs").textContent()) || "").trim();

    results.status.agentStatus = statusText;
    results.status.meta = metaText;
    results.status.logSample = logsText.slice(0, 600);

    const statusLower = statusText.toLowerCase();
    results.checks.runCompleted = statusLower.includes("completed");
    results.checks.metaHasRunId = /\([0-9a-f-]{36}\)/i.test(metaText);
    results.checks.logsContainCompletion = logsText.toLowerCase().includes("orchestration completed");
    results.checks.autoPrefilledTaskId = ((await page.inputValue("#agent-task-id")) || "")
      .trim()
      .toLowerCase()
      .startsWith("eng-");
    results.checks.autoPrefilledLinearIssue = ((await page.inputValue("#agent-linear-issue")) || "")
      .trim()
      .toUpperCase()
      .startsWith("ENG-");

    const screenshotPath = path.resolve("electron-agents-orchestrator-verification.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.artifacts.screenshot = screenshotPath;

    const outputPath = path.resolve("electron-agents-orchestrator-verification.json");
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
