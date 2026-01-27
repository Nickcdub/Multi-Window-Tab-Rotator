// popup.js

const $ = (id) => document.getElementById(id);

async function getLastFocusedWindowId() {
  const win = await chrome.windows.getLastFocused();
  return win.id;
}

function setStatus(windowId, cfg) {
  const interval = cfg?.intervalSec ?? (Number($("interval").value) || 10);

  $("status").textContent =
    `Window ID: ${windowId}\n` +
    `Rotation: ${cfg?.enabled ? "ON" : "OFF"}\n` +
    `Interval: ${interval}s (min 5)\n` +
    `Focus: ${cfg?.focusWindow ? "ON" : "OFF"}\n` +
    `Refresh on switch: ${cfg?.refreshOnRotate ? "ON" : "OFF"}`;
}

async function loadState() {
  // Ensure offscreen timer is running (no-op if already created)
  await chrome.runtime.sendMessage({ type: "ENSURE_OFFSCREEN" });

  const res = await chrome.runtime.sendMessage({ type: "GET_STATE_FOR_LAST_FOCUSED_WINDOW" });
  if (!res?.ok) {
    $("status").textContent = "Error: could not load state.";
    return;
  }

  const cfg = res.cfg;

  // Reflect saved settings (or defaults for an untracked window)
  $("interval").value = cfg?.intervalSec ?? 10;
  $("focusToggle").checked = Boolean(cfg?.focusWindow);
  $("refreshOnRotate").checked = Boolean(cfg?.refreshOnRotate);

  setStatus(res.windowId, cfg);
}

$("start").addEventListener("click", async () => {
  const raw = Number($("interval").value) || 10;
  const intervalSec = Math.max(5, raw);
  $("interval").value = intervalSec; // reflect clamp in UI

  await chrome.runtime.sendMessage({
    type: "START_ROTATION_FOR_LAST_FOCUSED_WINDOW",
    intervalSec,
    focusWindow: $("focusToggle").checked,
    refreshOnRotate: $("refreshOnRotate").checked
  });

  await loadState();
});

$("stop").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({
    type: "STOP_ROTATION_FOR_WINDOW",
    windowId: await getLastFocusedWindowId()
  });

  await loadState();
});

$("focusToggle").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    type: "SET_FOCUS_FOR_WINDOW",
    windowId: await getLastFocusedWindowId(),
    focusWindow: e.target.checked
  });

  await loadState();
});

$("refreshOnRotate").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    type: "SET_REFRESH_ON_ROTATE_FOR_WINDOW",
    windowId: await getLastFocusedWindowId(),
    refreshOnRotate: e.target.checked
  });

  await loadState();
});

loadState();