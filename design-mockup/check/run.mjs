// Check of the comment tool. Run it: node design-mockup/check/run.mjs
// It builds a demo page from assets/comment-tool.html, opens the page in headless Chrome, and drives it with real mouse and key events.
// It prints PASS or FAIL for each check, and exits with code 1 when a check fails.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep, MOD } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tool = readFileSync(join(here, "../assets/comment-tool.html"), "utf8");
const src = readFileSync(join(here, "demo.src.html"), "utf8");
if (!src.includes("<!-- @comment-tool -->")) throw new Error("demo.src.html has no marker");

const b = await launch();
const demo = join(b.dir, "demo.html");
writeFileSync(demo, src.replace("<!-- @comment-tool -->", () => tool));   // the function form keeps "$" in the tool as it is
const url = "file://" + demo;

let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };
const near = (a, b, d = 2) => Math.abs(a[0] - b[0]) <= d && Math.abs(a[1] - b[1]) <= d;
const popOpen = () => b.js(`!document.querySelector("#mk-pop").hidden`);
const pins = () => b.js(`[...document.querySelectorAll(".mk-pin")].map((p) => { const r = p.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, p.dataset.n]; })`);
const stored = () => b.js(`JSON.parse(localStorage.getItem("design-mockup-demo-v1") || "[]")`);
const pick = (v) => b.js(`(() => { const s = document.querySelector("#mk-state select"); s.value = "${v}"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
const centreNow = (sel) => b.js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);

try {
  await b.navigate(url + "#theme=light");
  await sleep(300);

  // 1. The start: comment mode is on, the hint is a fixed pill, the panel and the dialog are closed.
  const start = await b.js(`({
    on: document.body.classList.contains("mk-on"), hint: getComputedStyle(document.querySelector("#mk-hint")).position,
    hintShown: !document.querySelector("#mk-hint").hidden, panel: getComputedStyle(document.querySelector("#mk-panel")).display,
    list: getComputedStyle(document.querySelector("#mk-list")).listStyleType, theme: document.documentElement.dataset.theme })`);
  check("comment mode is on at the start, with a fixed hint", start.on && start.hint === "fixed" && start.hintShown, JSON.stringify(start));
  check("the panel is closed and the list has no marks (the demo has no reset)", start.panel === "none" && start.list === "none");

  // 2. A click on a live button adds a comment with a pin at the click. The button does not act.
  const ship = await b.centre("#ship");
  await b.click(...ship);
  check("a click opens the comment popover", await popOpen());
  await b.type("Make this button bigger.\nSecond line.");
  await b.key("Enter", MOD.meta);
  const after = await b.js(`({ pop: !document.querySelector("#mk-pop").hidden, acted: window.acted.ship, label: document.querySelector("#ship").textContent, hint: document.querySelector("#mk-hint").hidden })`);
  check("Cmd+Enter saves, and the button under the click does not act", !after.pop && after.acted === 0 && after.label === "Mark as shipped", JSON.stringify(after));
  const p1 = await pins();
  check("one pin, at the click", p1.length === 1 && near(p1[0], ship), JSON.stringify({ click: ship, pins: p1 }));
  check("the hint goes away after the first comment", after.hint === true);
  const s1 = await stored();
  check("the comment is in localStorage with an anchor", s1.length === 1 && s1[0].ctx === "order:o1042" && s1[0].path.length > 0 && s1[0].where === "Orders > Order detail", JSON.stringify(s1[0]));

  // 3. Other controls do nothing in comment mode. Escape cancels a draft.
  const before = await b.js(`location.hash`);
  for (const sel of ["#help-link", "#notify", "#more summary"]) {
    await b.click(...(await b.centre(sel)));
    const opened = await popOpen();
    await b.key("Escape");
    check(`click on ${sel} opens a draft, Escape drops it`, opened && !(await popOpen()) && (await pins()).length === 1);
  }
  const quiet = await b.js(`({ hash: location.hash, checked: document.querySelector("#notify").checked, open: document.querySelector("#more").open })`);
  check("link, switch and details do nothing", quiet.hash === before && !quiet.checked && !quiet.open, JSON.stringify(quiet));

  // 4. A click on the tool does not add a comment.
  await b.click(...(await b.centre("#mk-open")));
  const panelOpen = await b.js(`!document.querySelector("#mk-panel").hidden`);
  check("a click on the toolbar opens the panel and adds no comment", panelOpen && !(await popOpen()) && (await stored()).length === 1);
  await b.click(...(await b.centre("#mk-close")));

  // 5. The pin follows its element when the width and the theme change.
  const wide = await centreNow("#ship");
  await b.resize(600); await sleep(300);
  const narrow = await centreNow("#ship"), pn = await pins();
  check("the layout moved the button (the test means something)", Math.abs(narrow[1] - wide[1]) > 20, JSON.stringify({ wide, narrow }));
  check("the pin follows the button at a narrow width", pn.length === 1 && near(pn[0], narrow), JSON.stringify({ button: narrow, pin: pn[0] }));
  await b.resize(1280); await sleep(300);
  await b.click(...(await b.centre("#mk-theme"))); await sleep(300);
  const themed = await b.js(`document.documentElement.dataset.theme`), pt = await pins(), bt = await centreNow("#ship");
  check("the theme button works, and the pin stays on the button", themed === "dark" && pt.length === 1 && near(pt[0], bt));
  await b.click(...(await b.centre("#mk-theme"))); await sleep(200);

  // 6. A part that is drawn again with other data: its comments show only in that state. The list keeps them.
  await pick("o1043"); await sleep(300);
  const other = await b.js(`({ ctx: document.querySelector("#order").dataset.ctx, pins: document.querySelectorAll(".mk-pin").length, listed: document.querySelectorAll("#mk-list li [data-go]").length })`);
  check("in another state the pin is gone and the comment stays in the list", other.ctx === "order:o1043" && other.pins === 0 && other.listed === 1, JSON.stringify(other));
  await pick("o1042"); await sleep(300);
  check("back in the first state the pin returns on the button", near((await pins())[0] ?? [0, 0], await centreNow("#ship")));

  // 7. The export has the comment, its place, its state and its theme. It opens in a dialog.
  await b.click(...(await b.centre("#mk-copy"))); await sleep(300);
  const out = await b.js(`({ open: document.querySelector("#mk-export").open, text: document.querySelector("#mk-out").value, note: document.querySelector("#mk-copied").textContent })`);
  console.log("--- export ---\n" + out.text + "\n--- " + out.note);
  check("the export is in an open dialog and has the comment",
    out.open && /^#1 \[Orders > Order detail\] \(state: Order 1042 \(paid\)\) \(light theme\)$/m.test(out.text)
    && out.text.includes('On: "Mark as shipped" <button#ship>') && out.text.includes("Comment: Make this button bigger.\n    Second line."));
  check("the dialog says if the clipboard worked or not", /Copied|blocks the clipboard/.test(out.note), out.note);
  await b.key("Escape");
  // The fallback: when the browser blocks the clipboard, the dialog says so. The check forces the block.
  await b.js(`Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) }, configurable: true }); document.execCommand = () => false;`);
  await b.click(...(await b.centre("#mk-copy"))); await sleep(300);
  const blocked = await b.js(`document.querySelector("#mk-copied").textContent`);
  check("when the clipboard is blocked, the dialog says how to copy by hand", /blocks the clipboard.*Cmd\+C or Ctrl\+C/.test(blocked), blocked);
  await b.key("Escape");

  // 8. The comment stays after a reload. A click on the pin edits the comment. Delete removes it.
  await b.reload(); await sleep(300);
  check("the comment and its pin stay after a reload", (await pins()).length === 1 && (await stored()).length === 1);
  await b.click(...(await pins())[0].slice(0, 2));
  const edit = await b.js(`({ text: document.querySelector("#mk-text").value, del: !document.querySelector("#mk-del").hidden })`);
  check("a click on the pin opens its comment to edit", edit.text.startsWith("Make this button bigger.") && edit.del);

  // 9. The panel goes to a comment in its view and state, and the pin pulses.
  await b.key("Escape");
  await b.js(`mk.setView("settings")`); await sleep(200);
  await b.click(...(await b.centre("#mk-open")));
  await b.click(...(await b.centre('#mk-list [data-go="1"]'))); await sleep(500);
  const went = await b.js(`({ view: document.querySelector('[data-view="orders"]').hidden, pulse: !!document.querySelector(".mk-pin.hit") })`);
  check("a click in the panel goes to the view and pulses the pin", went.view === false && went.pulse, JSON.stringify(went));
  await b.click(...(await b.centre("#mk-close")));

  // 10. C turns comment mode off. Then the same button acts (the negative control).
  await b.key("c");
  const off = await b.js(`!document.body.classList.contains("mk-on")`);
  const [sx, sy] = await b.centre("#ship");
  await b.click(sx - 60, sy);   // not at the centre: the pin of comment 1 covers the centre of the button
  const acted = await b.js(`({ acted: window.acted.ship, label: document.querySelector("#ship").textContent })`);
  check("C turns comment mode off, and then the button acts", off && acted.acted === 1 && acted.label === "Shipped", JSON.stringify(acted));
  await b.key("c");
  check("C turns comment mode on again", await b.js(`document.body.classList.contains("mk-on")`));

  // 11. The delete button, and "Delete all" (cdp.mjs accepts the native confirm dialog).
  await b.click(...(await pins())[0].slice(0, 2));
  await b.click(...(await b.centre("#mk-del")));
  check("Delete removes the comment and its pin", (await stored()).length === 0 && (await pins()).length === 0);
  for (const sel of ["#ship", "#help-link"]) { await b.click(...(await b.centre(sel))); await b.type("Another comment."); await b.key("Enter", MOD.ctrl); }
  check("two new comments are numbered 1 and 2", (await pins()).map((p) => p[2]).join() === "1,2");
  await b.click(...(await b.centre("#mk-open")));
  await b.click(...(await b.centre("#mk-clear"))); await sleep(200);
  check("Delete all removes every comment", b.dialogs.length === 1 && (await stored()).length === 0 && (await pins()).length === 0);
  await b.click(...(await b.centre("#mk-close")));

  // 12. The address chooses the state: view, theme, comment=off.
  await b.navigate(url + "#view=settings&theme=dark&comment=off"); await sleep(300);
  const hash = await b.js(`({ settings: !document.querySelector('[data-view="settings"]').hidden, orders: document.querySelector('[data-view="orders"]').hidden, theme: document.documentElement.dataset.theme, on: document.body.classList.contains("mk-on") })`);
  check("the address chooses the view, the theme and comment=off", hash.settings && hash.orders && hash.theme === "dark" && !hash.on, JSON.stringify(hash));
  await b.click(...(await b.centre("#save")));
  check("with comment mode off, the form works", (await b.js(`window.acted.saved`)) === 1);

  // 13. The page loads nothing from another server, and has no script error.
  const foreign = b.requests.filter((u) => !/^(file|data|about|blob):/.test(u));
  check("no request to another server", foreign.length === 0, foreign.join(" "));
  check("no script error", b.errors.length === 0, b.errors.join(" | "));

  await b.shot(join(b.dir, "shot.png"));
  console.log(`demo page: ${demo}\nscreenshot: ${join(b.dir, "shot.png")}`);
} catch (e) {
  failed++;
  console.log("FAIL  the check stopped with an error:", e.message);
} finally {
  await b.close();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
