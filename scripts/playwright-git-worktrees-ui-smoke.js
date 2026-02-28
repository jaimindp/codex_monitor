#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { _electron: electron } = require("playwright");

async function main() {
  const repoRoot = process.cwd();
  const artifactsDir = path.join(repoRoot, "docs");
  const screenshotPath = path.join(artifactsDir, "hack-37-playwright-git-worktrees.png");
  const reportPath = path.join(artifactsDir, "hack-37-playwright-git-worktrees-test-output.json");

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const app = await electron.launch({
    args: ["."],
    cwd: repoRoot,
    timeout: 240000
  });

  try {
    let page = app.windows()[0] || null;
    if (!page) {
      page = await app.waitForEvent("window", { timeout: 60000 });
    }
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "Git + Worktrees" }).click();
    await page.locator("#github-root-input").fill("~/Documents/Vault/Hacks");
    await page.getByRole("button", { name: "Run Local Scan" }).click();

    await page.waitForFunction(() => {
      const statusEl = document.querySelector("#github-scan-status");
      if (!statusEl) {
        return false;
      }
      const text = String(statusEl.textContent || "").toLowerCase();
      if (!text.startsWith("git scan status:")) {
        return false;
      }
      return !text.includes("idle") && !text.includes("scanning local repositories");
    }, null, { timeout: 120000 });

    const status = (await page.locator("#github-scan-status").textContent()) || "";
    const summary = (await page.locator("#github-scan-summary").textContent()) || "";
    const repoCards = page.locator(".git-repo-card");
    const repoCount = await repoCards.count();
    const firstRepo = repoCount > 0 ? (await repoCards.first().locator("h4").textContent()) || "" : "";

    await page.screenshot({ path: screenshotPath, fullPage: true });

    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          ok: true,
          ranAt: new Date().toISOString(),
          rootInput: "~/Documents/Vault/Hacks",
          status,
          summary,
          repoCount,
          firstRepo,
          screenshotPath
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    process.stdout.write(`Playwright UI smoke finished. Status: ${status}\n`);
    if (!/completed/i.test(status)) {
      throw new Error(`Git scan did not complete successfully. Final status: ${status}`);
    }
    process.stdout.write(`Repo cards: ${repoCount}\n`);
    process.stdout.write(`Artifacts: ${screenshotPath}, ${reportPath}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
