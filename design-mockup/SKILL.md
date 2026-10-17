---
name: design-mockup
description: >
  Deliver a UI design as one self-contained HTML mock-up with a built-in comment tool. The user
  clicks any part of the page, writes a comment, and gets a numbered pin there. "Copy all" gives
  all comments as plain text, and the user pastes the text into the chat. Use when the user asks
  for a UI design, a mock-up, or a redesign to review, or asks to click and comment on a page.
  Also use when the user pastes comments in the export format ("#1 [View > Block] ...").
---

# Design mock-up with a comment tool

You deliver one HTML file. It holds the design, invented sample data, and the comment tool. It loads nothing from another server. The user opens the file, clicks a part of the design, and writes a comment. The user copies all comments as text and pastes them into the chat. You change the design and answer for each comment number.

Files in this skill:
- `assets/comment-tool.html`: the comment tool. It is one `<script>` block. Paste it unchanged into the mock-up.
- `check/run.mjs`: a check of the tool in headless Chrome. `check/demo.src.html` is its demo page.
- `check/cdp.mjs`: a small Chrome driver with no dependencies. Reuse it to test a design.

## Build the mock-up

1. Write the design as one HTML file. Put the CSS and the script inline. Use system fonts, inline SVG, or `data:` URLs. Use invented sample data.
2. Put the whole design in `<main id="stage">`. A click inside `#stage` adds a comment. The tool and its parts stay outside `#stage`.
3. Make each view a child of the stage: `<section data-view="overview" data-ctx="view:overview" data-name="Overview">`. A view is a page of the design, or a state that the user must compare (empty, full, error). The tool shows one view at a time. A design with one view needs no `data-view`.
4. Put `data-name="Readable name"` on each block (header, form, card, table). The export uses the nearest name as the location.
5. Put `data-ctx` on each region that your script draws again with other data. The value names the data, for example `data-ctx="invoice:late"`. Set it in the function that draws the region. A comment then shows its pin only when the region has that data. Each `data-ctx` value must be unique on the page at one time.
6. Write the dark theme as `:root[data-theme="dark"] { ... }`. The tool sets `data-theme` on `<html>`. If the design has no dark theme, set `theme: false`.
7. At the end of `<body>`, add the config. Then paste the whole text of `assets/comment-tool.html` after it. Do not retype the tool from memory. To avoid a copy error, write the line `<!-- @comment-tool -->` in the page and replace it with the file text by a script. `check/run.mjs` does this.

```html
<script>
window.MOCKUP = {
  title: "Billing",                    // the name of the design, for the export
  key: "mockup-billing-v1",            // the storage key: one for each mock-up
  views: { overview: "Overview", settings: "Settings" },   // optional, id: label
  state: {                             // optional: a choice of data in the toolbar
    label: "Invoice", options: { paid: "Paid invoice", late: "Late invoice" },
    views: ["overview"],               // optional: the views where the choice applies
    set: (id) => drawInvoice(id),      // draws the region and sets its data-ctx
  },
  theme: true,                         // false: no theme button
  onView: (id) => {}, onTheme: (t) => {},   // optional hooks
};
</script>
```

Rules for the page:
- Define `drawInvoice` and the other functions before the config. The tool calls `state.set` once when it starts.
- Make the page scroll as a whole. Do not use an inner scroll container. A pin does not follow a fixed or sticky element when the page scrolls.
- Use `click` handlers in the design. A handler on `mousedown`, `pointerdown`, or `mouseup` still acts in comment mode.
- The tool has its own reset and style. It uses a magenta accent, `--mk-accent`. If the design uses magenta, change that value in the tool.
- The tool redraws the pins by itself when the page changes. For an immediate redraw, call `mk.redraw()`.
- Storage key: a comment stores the path of child positions below its `data-ctx` element. When the structure of the page changes, the old paths point to wrong elements. Then change the key (`-v2`) and tell the user that the old pins are gone.

## What the tool does

- Comment mode is on at the start. A fixed pill shows how to comment. The key `C` and a toolbar button turn comment mode on and off.
- In comment mode, a click in `#stage` adds a comment and does nothing else. Links, buttons, switches, `<details>` and forms do not act. A click on the tool adds no comment.
- A popover opens for the comment. Cmd/Ctrl+Enter saves. Escape cancels. A click on another part saves the open comment and starts a new one. An empty comment is dropped.
- A pin shows each comment. A click on a pin opens its comment to edit or delete.
- The panel lists all comments. A click on one goes to its view and state, scrolls to it, and pulses the pin. The panel has Delete, Delete all, and Copy all.
- Comments stay in `localStorage` under the storage key.
- The URL hash chooses the start: `#view=settings&theme=dark&state=late&comment=off`.

## Hand over

Give the user the file path. Then tell the user three things:
1. Comment mode is on. Click any part of the page, write a comment, and press Cmd+Enter. Each comment gets a numbered pin. Press `C` to use the page without comments.
2. The toolbar changes the view, the state, and the theme.
3. To send the comments, click **Copy all** and paste the text into the chat. If the browser blocks the clipboard (a `file://` page can), the dialog shows the text selected. Press Cmd+C and paste it.

If you changed the storage key, say that the old pins are gone.

## When the user pastes the export

The export has this form:

```
Comments on the mock-up "Billing" (2)

#1 [Overview > Invoice card] (state: Late invoice) (light theme)
  On: "Pay now" <button#pay.btn>
  Comment: Make this button bigger.
```

1. Find the element for each comment. The location `[View > Block]` gives the `data-view` and the `data-name`. The state gives the option and its `set` function. The label and the tag (`tag#id.class`) give the element.
2. If one comment is not clear, ask one question about that comment. Do the other comments.
3. Make all the changes in the file.
4. Answer for each comment number: `#1: done, <the change>`, `#1: not done, <the reason>`, or `#1: <the question>`.
5. If the structure of the page changed, change the storage key. Tell the user that the old pins are gone. If the key stays, tell the user to click Delete all.

## Verify the page

Use one headless Chrome session over the DevTools protocol. `check/cdp.mjs` does this:

```js
import { launch } from "<skill directory>/check/cdp.mjs";
const b = await launch();   // then b.navigate, b.js, b.centre, b.click, b.key, b.type, b.shot, b.resize
try { /* your checks */ } finally { await b.close(); }
```

- Do not run `chrome --headless --screenshot` several times in a row. It hangs on the machine of the user. Take each screenshot in the one session with `b.shot(path)`.
- `launch()` uses a free debugging port and a new profile directory. If you start Chrome by hand, use your own port and your own `--user-data-dir`. Stop only the process that you started, by its PID. Never run `pkill` on Chrome. Other sessions can run their own Chrome.
- Use real input events (`b.click`, `b.key`). Do not use `el.click()`. A key event needs `rawKeyDown` with `windowsVirtualKeyCode`. `b.key` does this.
- Scroll an element into view before you click it. `b.centre(selector)` does this and returns the point to click.
- A pin covers the point of its click. To click the control under a pin, click another point of the control.
- A native `confirm()` blocks the page. `cdp.mjs` accepts it.
- Open each view, state, and theme with the URL hash. Use `comment=off` for a screenshot without the pill.
- Look at the screenshots in light and dark theme, and at a phone width (`b.resize(390)`).
- Test each control of the design in comment mode: it must do nothing. Press `C`: it must act. Without the second step, the first step can pass because the control never worked.

Run the check after you change the tool:

```bash
node <skill directory>/check/run.mjs
```

It needs Node 22 or later and Chrome (set `CHROME` to a path if Chrome is not found). The last line must be `all checks passed`. The check builds `demo.html` from the tool in a temporary directory and prints its path.
