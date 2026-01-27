// Tick every second and ask background to rotate whatever is due.
setInterval(() => {
    chrome.runtime.sendMessage({ type: "TICK" });
}, 1000);
