// A small driver for one headless Chrome session over the DevTools protocol.
// It needs Node 22 or later (built-in WebSocket and fetch) and no package.
// Chrome picks a free debugging port. The profile lives in a new temporary directory.
// close() stops only the Chrome process that this file started, by its PID.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const fixed = process.env.CHROME ? [process.env.CHROME] : [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  for (const p of fixed) if (existsSync(p)) return p;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const r = spawnSync("which", [name], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.trim();
  }
  throw new Error("Chrome not found. Set the CHROME variable to the path of the Chrome binary.");
}

// Virtual key codes for the keys that a design check needs. Add a key here when a check needs it.
const KEYS = { Escape: ["Escape", 27], Enter: ["Enter", 13], Tab: ["Tab", 9] };
for (const c of "abcdefghijklmnopqrstuvwxyz") KEYS[c] = ["Key" + c.toUpperCase(), c.toUpperCase().charCodeAt(0)];
export const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

export async function launch({ width = 1280, height = 900 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "design-mockup-"));
  const profile = join(dir, "profile");
  const proc = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, "about:blank",
  ], { stdio: "ignore" });
  const exited = new Promise((r) => proc.once("exit", r));
  try {
    let port = 0;
    for (let i = 0; i < 100 && !port; i++) {   // Chrome writes the port that it chose to this file
      await sleep(100);
      try { port = +readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
    }
    if (!port) throw new Error("Chrome did not start");
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
      if (!target) await sleep(100);
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const waiting = new Map(), errors = [], requests = [], dialogs = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id) return waiting.get(d.id)?.(d);
      if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      if (d.method === "Network.requestWillBeSent") requests.push(d.params.request.url);
      if (d.method === "Page.javascriptDialogOpening") {   // a native dialog blocks the page, so accept it at once
        dialogs.push(d.params.message);
        send("Page.handleJavaScriptDialog", { accept: true });
      }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      waiting.set(++id, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
    const js = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    for (const m of ["Runtime.enable", "Page.enable", "Network.enable"]) await send(m);
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

    return {
      send, js, errors, requests, dialogs,
      resize: (w, h = height) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 }),
      async navigate(url) { await send("Page.navigate", { url }); await sleep(600); },
      async reload() { await send("Page.reload"); await sleep(600); },
      // Scroll the element to the middle of the window, then return the middle of its box in viewport coordinates.
      centre: (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error("no element: ${sel.replace(/"/g, "'")}"); e.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`),
      // A real mouse click: move, press, release.
      async click(x, y) {
        for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
          await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
        }
        await sleep(150);
      },
      // A real key press. rawKeyDown with windowsVirtualKeyCode is the form that page handlers see for every key.
      async key(name, modifiers = 0) {
        const [code, vk] = KEYS[name];
        const e = { key: name, code, windowsVirtualKeyCode: vk, modifiers };
        await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...e });
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...e });
        await sleep(120);
      },
      type: (text) => send("Input.insertText", { text }),
      async shot(path) { writeFileSync(path, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64")); },
      dir,
      async close() {
        try { ws.close(); } catch {}
        proc.kill();   // the PID of this process only
        await Promise.race([exited, sleep(3000)]);
        rmSync(profile, { recursive: true, force: true });
      },
    };
  } catch (e) {
    proc.kill();
    throw e;
  }
}
