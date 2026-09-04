# Privacy Policy for Steroid

**Effective date: September 5, 2026**
**Last updated: September 5, 2026**

Steroid is a command palette for Chrome. You open it with Shift+Shift on any page to fuzzy-search and switch between your open tabs, close tabs, create and delete tab groups, and run quick searches.

Steroid has **no backend server**. There is no account, no login, no analytics, no telemetry, no crash reporting, no advertising, no tracking, and no third-party SDKs. The extension is open source under the MIT license, so every claim in this policy can be checked against the code: <https://github.com/amankhandelwal/steroid>.

Publisher: Aman Khandelwal (individual developer).
Contact: <aman.khandelwal.howrah@gmail.com>

---

## 1. What Steroid handles

Steroid works with a small amount of data, all of it kept on your own computer unless a section below says otherwise.

| Data | Why it is needed | Where it lives |
| --- | --- | --- |
| Titles, URLs, tab IDs and window IDs of your open tabs | To list, fuzzy-search, switch to, close and group tabs — the core of the palette | Read live from Chrome when the palette is open; not written to disk by Steroid |
| Recently visited tab history (tab ID, window ID, timestamp — up to the last 100 tabs) | Powers the "Previous Tab" command and orders search results most-recent-first | `chrome.storage.local` on your machine |
| Tab last-access times (tab ID → timestamp) | Same: reverse-chronological ordering of results | `chrome.storage.local` on your machine |
| Your OpenAI API key, if you choose to set one | Authenticates the optional "Smart Group" feature against OpenAI, using **your** OpenAI account | `chrome.storage.local` on your machine |
| What you type into the palette | Runs the command you typed | Held in memory only, discarded when the palette closes |

Note that the stored history records **tab and window identifiers plus timestamps**, not page titles or URLs.

## 2. What Steroid does **not** collect

Steroid never reads, stores, or transmits:

- the content of the web pages you visit — no DOM scraping, no text extraction, no screenshots;
- cookies, session tokens, or anything in local storage belonging to the sites you visit;
- form input, passwords, or payment details typed into web pages;
- your browsing history from Chrome's history API (Steroid does not request the `history` permission);
- your name, email address, IP address, location, or device identifiers;
- keystrokes on the page. The content script listens for Shift+Shift to summon the palette and, once open, for keys directed at the palette itself. It does not log or transmit what you type anywhere else.

There is no server for any of this to be sent to.

## 3. Permissions, and why each one exists

Steroid's `manifest.json` declares exactly these:

- **`tabs`** — to read the titles and URLs of your open tabs so they can be listed and searched, and to switch to or close the one you pick.
- **`tabGroups`** — to create, name, and remove Chrome tab groups.
- **`storage`** — to keep the recent-tab history and (optionally) your OpenAI API key locally, via `chrome.storage.local`.
- **`scripting`** — to inject the palette into tabs that were already open when the extension was installed, updated, or restarted, since Chrome does not auto-inject into those. It injects Steroid's own UI script and nothing else.
- **Host permission `https://api.openai.com/*`** — the only host Steroid is allowed to send requests to, and only for the optional Smart Group feature (see Section 4).
- **A content script matching `<all_urls>`.**

### About `<all_urls>`

This is the permission that deserves the most scrutiny, so here is the plain explanation.

Steroid's whole premise is that Shift+Shift summons the palette **on any page**. A content script can only listen for that shortcut on pages where it is present, and there is no way to know in advance which page you will be on. Chrome therefore requires a match pattern covering all sites.

What the script actually does on your pages is narrow: it attaches a hidden container (an isolated Shadow DOM host) to the page, listens for the Shift+Shift shortcut, and renders the palette UI when you trigger it. It does **not** read the page's content, its DOM, its cookies, its forms, or its network traffic, and it sends nothing about the page anywhere. `<all_urls>` grants the capability to reach every page; Steroid uses it only for presence, not for surveillance. The source file is [`src/content.tsx`](https://github.com/amankhandelwal/steroid/blob/main/src/content.tsx) if you want to read it yourself.

## 4. What leaves your machine

### 4.1 Smart Group (opt-in, off by default)

Steroid makes network requests to OpenAI **only** if you take two deliberate steps: you set your own OpenAI API key via the "Set API Key" command, and you then run the "Smart Group" command.

When you run Smart Group, Steroid sends to `https://api.openai.com/v1/chat/completions` (model `gpt-4o-mini`):

- the **title**, **URL**, tab ID and window ID of each of your open tabs, up to a maximum of 100 tabs;
- each title and URL truncated to 200 characters;
- your API key in the `Authorization` header.

Nothing else is sent — no page content, no cookies, no form data, no DOM, no personal profile. The response is a proposed grouping of tab IDs, which Steroid applies locally.

Additionally, when you first save an API key, Steroid makes a single validation request to `https://api.openai.com/v1/models` with that key, to confirm it works before storing it. No tab data is included in that request.

Because you are using your own OpenAI account, **OpenAI's terms and privacy practices apply to those requests**. Steroid has no visibility into and no control over what OpenAI does with them. See <https://openai.com/policies/>.

**If you never set an API key, Steroid makes no requests to OpenAI at all.**

### 4.2 Web fonts — bundled, not fetched

The palette's two typefaces (Space Grotesk and JetBrains Mono) are **bundled inside the extension** and embedded directly in its stylesheet. No request is made to Google Fonts, `fonts.gstatic.com`, or any other font host, on any page, ever.

This is worth stating explicitly because it is a common and easy-to-miss leak: an extension that styles itself with a remotely hosted font, in a stylesheet injected into every page you visit, quietly reports each of those page loads to the font's host. Steroid deliberately does not do this.

### 4.3 Searches and opened URLs

When you use the "Search" command or open a URL from the palette, Steroid opens a normal browser tab pointing at the search engine or site you chose (Google, DuckDuckGo, Bing, YouTube, GitHub, Stack Overflow, Wikipedia, or Reddit). Your query goes to that site the same way it would if you had typed it in the address bar. Steroid does not intercept, log, or copy it, and does not send it anywhere else.

That is the complete list. There are no other outbound connections. If you never set an OpenAI API key, Steroid makes **no network requests of any kind** — the extension is entirely local.

## 5. Where data is stored, and for how long

Everything Steroid persists is stored in `chrome.storage.local` on your own device. It is not synced to your Google account, not backed up by the developer, and not accessible to the developer or anyone else.

- Tab history is capped at the 100 most recent entries and is pruned automatically as tabs close.
- Tab access times are pruned when the corresponding tabs close.
- Your API key is retained until you overwrite it or uninstall the extension.

Uninstalling Steroid deletes all of it.

## 6. Your control

- **Never enable the network feature.** Don't set an API key, and Steroid never contacts OpenAI.
- **Remove your API key.** Overwrite it with the "Set API Key" command, or clear the extension's storage entirely — Chrome → Extensions → Steroid → "Clear data" / remove and reinstall.
- **Clear local data.** Uninstalling Steroid removes its `chrome.storage.local` contents, including tab history and any stored key.
- **Revoke at the source.** An OpenAI key can be deleted at any time from your OpenAI account dashboard, which immediately stops Steroid from being able to use it.
- **Inspect the code.** The full source is on GitHub; you can build and load it yourself.

Since the developer holds no copy of your data on any server, there is nothing for us to look up, export, correct, or delete on your behalf — requests of that kind are handled entirely by you, on your own machine, using the controls above. Data you sent to OpenAI through your own account is subject to OpenAI's controls and your agreement with them.

## 7. Limited use of data

In line with the Chrome Web Store User Data Policy, including the Limited Use requirements, Steroid affirms that:

- data handled by the extension is used **only** to provide or improve its single purpose — a command palette for finding, switching, closing and grouping your tabs;
- the developer does **not sell or transfer** user data to third parties, other than the transfer to OpenAI that you explicitly initiate with your own API key, and other than what may be required by law;
- the developer does **not** use or transfer user data for advertising, marketing, or any other purpose unrelated to the extension's single purpose;
- the developer does **not** use or transfer user data to determine creditworthiness or for lending purposes;
- no humans read your data. The developer has no access to it at all, because it never leaves your device.

## 8. Children's privacy

Steroid is a general-purpose productivity tool and is not directed at children under 13. It does not knowingly collect personal information from anyone, children included, and it has no server on which such information could be received or stored.

## 9. Security

Your data stays on your device, protected by Chrome's own extension storage isolation and your operating system's user account controls. The one outbound request Steroid can make travels over HTTPS. Your API key is stored in `chrome.storage.local`, which is readable by anyone with access to your logged-in OS user profile — treat it as you would any credential on your machine, and prefer a scoped key with a spending limit.

## 10. Changes to this policy

If Steroid's data handling changes, this policy will be updated and the "Last updated" date at the top will change. Because the extension is open source, the revision history of this file is public in the repository. Material changes — a new data flow, a new recipient — will also be noted in the extension's release notes. Continuing to use Steroid after an update means you accept the revised policy.

## 11. Contact

Questions, concerns, or corrections:

- Email: <aman.khandelwal.howrah@gmail.com>
- Issues: <https://github.com/amankhandelwal/steroid/issues>
