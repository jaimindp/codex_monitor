const versionsEl = document.getElementById("versions");
const pingBtn = document.getElementById("ping-btn");
const pingResultEl = document.getElementById("ping-result");
const listenInput = document.getElementById("listen-input");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const serverStatusEl = document.getElementById("server-status");
const logOutputEl = document.getElementById("log-output");

let unsubscribeState = null;
let unsubscribeLog = null;

if (versionsEl) {
  const { chrome, electron, node } = window.monitor.versions;
  versionsEl.textContent = `Electron ${electron} | Chrome ${chrome} | Node ${node}`;
}

if (pingBtn && pingResultEl) {
  pingBtn.addEventListener("click", async () => {
    const response = await window.monitor.ping();
    pingResultEl.textContent = `Main process replied: ${response}`;
  });
}

function renderStatus(state) {
  if (!serverStatusEl || !startBtn || !stopBtn || !listenInput) {
    return;
  }

  const status = state.running
    ? `running (pid ${state.pid}) on ${state.listen}`
    : "stopped";
  const lastExit =
    state.lastExitCode === null && state.lastExitSignal === null
      ? "none"
      : `code=${String(state.lastExitCode)}, signal=${String(state.lastExitSignal)}`;

  serverStatusEl.textContent = `Status: ${status}. Last exit: ${lastExit}.`;
  startBtn.disabled = Boolean(state.running);
  stopBtn.disabled = !state.running;
  listenInput.disabled = Boolean(state.running);
}

function appendLogs(lines) {
  if (!logOutputEl || !Array.isArray(lines)) {
    return;
  }

  const current = logOutputEl.textContent ? `${logOutputEl.textContent}\n` : "";
  logOutputEl.textContent = `${current}${lines.join("\n")}`;
  logOutputEl.scrollTop = logOutputEl.scrollHeight;
}

async function refreshFromMain() {
  const state = await window.monitor.codexServer.getState();
  renderStatus(state);
  if (Array.isArray(state.logs)) {
    logOutputEl.textContent = state.logs.join("\n");
    logOutputEl.scrollTop = logOutputEl.scrollHeight;
  }
}

if (startBtn && stopBtn && listenInput) {
  startBtn.addEventListener("click", async () => {
    const listen = listenInput.value.trim() || "stdio://";
    await window.monitor.codexServer.start(listen);
  });

  stopBtn.addEventListener("click", async () => {
    await window.monitor.codexServer.stop();
  });
}

unsubscribeState = window.monitor.codexServer.onState((state) => {
  renderStatus(state);
});
unsubscribeLog = window.monitor.codexServer.onLog((lines) => {
  appendLogs(lines);
});
refreshFromMain();

window.addEventListener("beforeunload", () => {
  if (unsubscribeState) {
    unsubscribeState();
  }
  if (unsubscribeLog) {
    unsubscribeLog();
  }
});
