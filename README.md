**Multi-Window Tab Rotator**

Multi-Window Tab Rotator lets you automatically rotate tabs in one or more Chrome windows at a configurable interval. Each window can be controlled independently, making it useful for dashboards, monitoring displays, or any workflow where multiple tabs need to cycle automatically.

**Features**

Rotate tabs in one or more Chrome windows

Set a per-window rotation interval (minimum 5 seconds)

Optional window focusing during rotation

Optional automatic refresh when tabs change

Start and stop rotation per window

Works on macOS, Windows, and Linux

**How to Use**

Open one or more Chrome windows with multiple tabs.

Open the extension while the window you want to configure is focused.

Choose a rotation interval.

Toggle Focus window while rotating and Refresh on tab switch as desired.

Click Start to begin rotation for the current window.

Note: The Focus and Refresh toggles do not take effect until rotation is started. Once running, these settings can be changed at any time and will apply immediately.

Click Stop to disable rotation for the current window. Each window can be configured independently.

**Permissions**

windows – Used to identify and optionally focus Chrome windows.

storage – Used to store per-window settings locally.

offscreen – Used to maintain reliable timing under Manifest V3.

No browsing data is collected or transmitted.

**Development**

This extension is built using Chrome Manifest V3 and does not load remote code. All logic runs locally in the browser.
