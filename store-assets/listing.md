# Chrome Web Store listing — Steroid v1.0.0

Every field the Developer Dashboard asks for, ready to paste. Character limits are noted where the
store enforces one. Keep this file in sync with `public/manifest.json` — reviewers compare the two,
and a justification that describes a permission the extension no longer requests (or omits one it
does) is a rejection.

Assets to upload live alongside this file:

| Field | File |
| --- | --- |
| Store icon (128×128) | `store-assets/store-icon-128.png` |
| Screenshots (1280×800, 1–5) | `store-assets/screenshots/screenshot-{1..4}.png` |
| Package | `steroid-1.0.0.zip` (produced by `npm run package`) |

A 440×280 small promo tile is optional and not currently produced. Without one, the listing simply
will not be eligible for homepage promotion — it does not block publishing.

---

## Store listing tab

**Title** (max 75)

```
Steroid — Command Palette for Chrome
```

**Summary** (max 132; this is the manifest `description` and should stay identical to it)

```
A command palette for Chrome, inspired by IntelliJ's Shift+Shift.
```

**Category:** Workflow & Planning
**Language:** English

**Detailed description**

```
Press Shift+Shift on any page. A command palette opens, and your keyboard does the rest.

Steroid brings the Shift+Shift command palette from IntelliJ — and the Cmd+K palettes of editors
like VS Code — to Chrome, so you can find a tab, run an action or organise your windows without
reaching for the mouse or squinting at a row of 40 unreadable tab favicons.

FIND ANY TAB, INSTANTLY
• Fuzzy search across every open tab by title or URL — partial and out-of-order matches work
• Results are ordered by how recently you visited each tab, so the tab you want is usually first
• Arrow keys to move, Enter to switch, and ` (backtick) to close a tab straight from the results
• "Previous Tab" jumps back to where you just were, and shows you where that is before you commit

TAB AND WINDOW MANAGEMENT
• Close multiple tabs at once by search term — "close youtube" clears them in one action
• Close duplicate tabs, a problem most people don't notice until they look
• Create and name tab groups, or ungroup everything in one command
• Smart Group (optional): organises your open tabs into named groups and windows for you

SEARCH AND NAVIGATE
• Type "s" followed by your query, then pick where to send it — Google, DuckDuckGo, Bing, YouTube,
  GitHub, Stack Overflow, Wikipedia or Reddit
• Paste or type a URL and press Enter to open it in a new tab
• The engine list is configurable

BUILT TO STAY OUT OF THE WAY
• The palette lives in an isolated Shadow DOM, so it can't be restyled or broken by the page
• Keystrokes are contained: with the palette open, typing "s" or "t" on GitHub won't fire GitHub's
  own hotkeys behind it
• Follows your system's light and dark mode

WHERE IT WORKS, AND WHERE IT CAN'T
Steroid opens on ordinary web pages. Chrome does not allow any extension to run on its own internal
pages, so Shift+Shift will not work on the New Tab page, on chrome:// pages such as Settings or
History, on the Chrome Web Store, or on other extensions' pages. This is a browser restriction, not
a bug, and no extension can work around it — switch to any normal tab and the palette is there.

Local files (file:/// URLs) need one extra step: open chrome://extensions, click Details on Steroid,
and turn on "Allow access to file URLs".

ABOUT YOUR DATA
Steroid has no server, no analytics, no telemetry and no ads. Your tabs and your browsing stay on
your machine.

The one exception is entirely opt-in: the Smart Group command sends your tab titles and URLs to
OpenAI to work out sensible groupings. It uses an OpenAI API key that you supply yourself, it runs
only when you explicitly invoke it, and if you never set a key, Steroid makes no network requests
at all. Fonts are bundled in the extension rather than fetched, so browsing normally with Steroid
installed contacts nobody.

Steroid is free, MIT-licensed and open source. Read the code, or file an issue, at
https://github.com/amankhandelwal/steroid

Privacy policy: https://github.com/amankhandelwal/steroid/blob/main/PRIVACY.md
```

---

## Privacy tab

### Single purpose description

```
Steroid provides a single keyboard-driven command palette, opened with Shift+Shift, for finding and
switching between open tabs and running tab and window management commands. Every feature —
fuzzy tab search, closing tabs, tab grouping, quick searches and URL opening — exists to serve that
one purpose.
```

### Permission justifications

**`tabs`**

```
Reads the titles and URLs of the user's open tabs so they can be listed and fuzzy-searched in the
palette, and switches to or closes the tab the user selects. This is the extension's core function:
without it there is nothing to search.
```

**`tabGroups`**

```
Creates, names, colours and removes Chrome tab groups. This backs the "Create Group", "Smart Group"
and "Ungroup All" commands, which are user-invoked tab organisation actions.
```

**`storage`**

```
Stores two things locally with chrome.storage.local: the user's own OpenAI API key, if they choose
to set one for the optional Smart Group command, and a short history of recently-visited tab IDs
used to order search results by recency and to power the "Previous Tab" command. Neither is
transmitted anywhere.
```

**`scripting`**

```
Injects the palette's content script into tabs that were already open at the moment the extension
was installed, updated or re-enabled. The manifest's declarative content script only runs on pages
loaded afterwards, so without this the palette would not open on any pre-existing tab until the user
reloaded it. It injects only the extension's own bundled content.js and never remote code.
```

**Host permission `https://api.openai.com/*`**

```
Used only by the optional Smart Group command. When the user explicitly runs it, the extension sends
the titles and URLs of their open tabs to the OpenAI chat completions API, authenticated with an API
key the user supplies themselves, and receives back a suggested grouping. There is one additional
request to validate the key when it is first saved. No request is made to this host unless the user
has set a key and invoked the command.
```

**Broad host access (`<all_urls>` content script)**

```
The palette is summoned with Shift+Shift on whatever page the user is currently looking at, so the
script that listens for that shortcut and renders the palette must be present on all sites. Its
scope on the page is deliberately minimal: it attaches an isolated Shadow DOM host, listens for the
shortcut, and draws the palette UI. It does not read page content, the DOM, cookies, form data or
network traffic, and it transmits nothing about the pages the user visits. The extension has no
server to transmit to.
```

**Remote code**

```
No, I am not using remote code.
```

All executable code, and both webfonts, are bundled in the package. There are no remote scripts,
no `eval`, and no remotely hosted stylesheets or fonts.

### Data usage disclosures

Check these categories:

- [x] **Personally identifiable information** — no
- [x] **Health information** — no
- [x] **Financial and payment information** — no
- [x] **Authentication information** — **YES**. The user's own OpenAI API key, stored locally and sent only to OpenAI in an `Authorization` header.
- [x] **Personal communications** — no
- [x] **Location** — no
- [x] **Web history** — no. Steroid reads the user's *currently open tabs*, not their browsing history, and persists only tab IDs, not URLs.
- [x] **User activity** — no
- [x] **Website content** — **YES**. Tab titles and URLs, sent to OpenAI only when the user runs Smart Group.

Then certify all three:

- [x] I do not sell or transfer user data to third parties, apart from the approved use cases
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** — required, since Authentication information and Website content are declared:

```
https://github.com/amankhandelwal/steroid/blob/main/PRIVACY.md
```

A raw GitHub URL is accepted. A GitHub Pages URL is tidier if you'd rather host it properly.

---

## Before you hit Submit

- [ ] Version in `public/manifest.json` matches the zip filename
- [ ] The zip opens with `manifest.json` at its root, not nested inside `dist/`
- [ ] The privacy policy URL resolves publicly (log out, or open it in a private window, and check)
- [ ] Screenshots show the real palette and no private tab titles you would rather not publish —
      the current four include personal file paths and repository names, so review them first
- [ ] Distribution set to Public, and the correct regions

Expect a slower first review than usual: `<all_urls>` plus a broad host permission puts the item in
the manual-review queue, which typically takes days rather than hours.
