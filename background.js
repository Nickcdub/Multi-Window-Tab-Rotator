// background.js

const OFFSCREEN_URL = "offscreen.html";
const STORAGE_KEY = "rotations";

// Prevent overlapping rotates per window
const rotatingLocks = new Set();

async function ensureOffscreen() {
  // If Offscreen API isn't available (older Chrome), fail gracefully.
  if (!chrome.offscreen?.createDocument) return;

  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) return;

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_URL),
    // Note: Offscreen documents exist to enable DOM APIs in MV3; we use it to host
    // a timer that can keep sub-minute scheduling running while the SW may suspend.
    reasons: ["DOM_PARSER"],
    justification:
      "Run a seconds-level timer in an offscreen document to schedule tab rotation in MV3 when the service worker may suspend."
  });
}

async function getRotations() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] ?? {};
}

async function setRotations(rotations) {
  await chrome.storage.local.set({ [STORAGE_KEY]: rotations });
}

// Rotate tabs in a window. Optionally focus window and/or refresh the newly active tab.
async function rotateWindowOnce(windowId, focusWindow, refreshOnRotate) {
  const tabs = await chrome.tabs.query({ windowId });
  if (!tabs?.length) return false;

  const activeIndex = tabs.findIndex((t) => t.active);
  if (activeIndex === -1) return false;

  const nextIndex = (activeIndex + 1) % tabs.length;
  const nextTabId = tabs[nextIndex]?.id;
  if (!nextTabId) return false;

  if (focusWindow) {
    await chrome.windows.update(windowId, { focused: true });
  }

  // Switch to the next tab
  await chrome.tabs.update(nextTabId, { active: true });

  // Refresh the newly active tab (only when rotation triggers the switch)
  if (refreshOnRotate) {
    await chrome.tabs.reload(nextTabId);
  }

  return true;
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureOffscreen();
});

// Remove saved config when a window closes
chrome.windows.onRemoved.addListener(async (windowId) => {
  const rotations = await getRotations();
  if (rotations[windowId]) {
    delete rotations[windowId];
    await setRotations(rotations);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "ENSURE_OFFSCREEN") {
        await ensureOffscreen();
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "GET_STATE_FOR_LAST_FOCUSED_WINDOW") {
        const win = await chrome.windows.getLastFocused();
        const rotations = await getRotations();
        const cfg = rotations[win.id] ?? null;
        sendResponse({ ok: true, windowId: win.id, cfg });
        return;
      }

      if (msg?.type === "START_ROTATION_FOR_LAST_FOCUSED_WINDOW") {
        await ensureOffscreen();

        const win = await chrome.windows.getLastFocused();
        const rotations = await getRotations();

        // Enforce minimum interval (5s) to reduce churn.
        const intervalSec = Math.max(5, Number(msg.intervalSec) || 10);
        const focusWindow = Boolean(msg.focusWindow);
        const refreshOnRotate = Boolean(msg.refreshOnRotate);

        const existing = rotations[win.id];

        // Idempotent start: preserve lastRotatedAt if already enabled to avoid jitter
        rotations[win.id] = {
          enabled: true,
          intervalSec,
          focusWindow,
          refreshOnRotate,
          lastRotatedAt:
            existing?.enabled ? (existing.lastRotatedAt ?? Date.now()) : Date.now()
        };

        await setRotations(rotations);
        sendResponse({ ok: true, windowId: win.id });
        return;
      }

      if (msg?.type === "STOP_ROTATION_FOR_WINDOW") {
        const rotations = await getRotations();
        if (rotations[msg.windowId]) {
          rotations[msg.windowId].enabled = false;
          await setRotations(rotations);
        }
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "SET_FOCUS_FOR_WINDOW") {
        const rotations = await getRotations();
        if (rotations[msg.windowId]) {
          rotations[msg.windowId].focusWindow = Boolean(msg.focusWindow);
          await setRotations(rotations);
        }
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "SET_REFRESH_ON_ROTATE_FOR_WINDOW") {
        const rotations = await getRotations();
        if (rotations[msg.windowId]) {
          rotations[msg.windowId].refreshOnRotate = Boolean(msg.refreshOnRotate);
          await setRotations(rotations);
        }
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "TICK") {
        const rotations = await getRotations();
        const now = Date.now();

        let dirty = false;

        for (const [windowIdStr, cfg] of Object.entries(rotations)) {
          if (!cfg?.enabled) continue;

          const windowId = Number(windowIdStr);
          const intervalMs = (cfg.intervalSec ?? 10) * 1000;
          const last = cfg.lastRotatedAt ?? 0;

          if (now - last < intervalMs) continue;

          if (rotatingLocks.has(windowId)) continue;
          rotatingLocks.add(windowId);

          try {
            const didRotate = await rotateWindowOnce(
              windowId,
              Boolean(cfg.focusWindow),
              Boolean(cfg.refreshOnRotate)
            );

            if (didRotate) {
              cfg.lastRotatedAt = now;
              dirty = true;
            }
          } catch (e) {
            // Window might be gone or inaccessible
            cfg.enabled = false;
            dirty = true;
          } finally {
            rotatingLocks.delete(windowId);
          }
        }

        // Only write to storage if something changed (reduces churn).
        if (dirty) {
          await setRotations(rotations);
        }

        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message ?? err) });
    }
  })();

  return true;
});
