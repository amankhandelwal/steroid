# The Plan

Prepare Steroid for its first submission to the Chrome Web Store.

This is a **release-readiness plan**, not a feature plan. It came out of an audit of the manifest,
the build output and the data-handling code against the Chrome Web Store's program policies. Each
item below is either a hard blocker (the store rejects or warns on it) or a required submission
artefact that does not exist yet.

Two things are explicitly out of scope: any behavioural change to the palette itself, and the actual
click-through of the Developer Dashboard (the user does that, with the copy prepared here).

## Constraints

- Icons and screenshots are generated with **PixelFit** (`../PixelFit`), used as a library, not by
  hand and not with `sips`/ImageMagick.
- No global tool or dependency version changes.
- No git commands.

# Task list

## A. Manifest & packaging blockers

- [x] **A1 — Generate icon set.** `public/icon.png` is a single 1024×1024, 1.5 MB PNG used for both
      declared sizes. Produce 16/32/48/128 with PixelFit into `public/icons/`.
- [x] **A2 — Declare all four icon sizes** in `public/manifest.json`. The store requires a 128×128;
      it is currently absent, which alone blocks submission.
- [x] **A3 — Remove the invalid `type: "module"` key** from the `content_scripts[0]` entry. It is not
      a supported manifest key and raises an "Unrecognized manifest key" warning. The built
      `content.js` is already a plain IIFE with no top-level imports, so the key is inert.
- [x] **A4 — Stop shipping the 1024×1024 source icon** into `dist/`, so the package carries four
      small PNGs instead of a 1.5 MB one.
- [x] **A5 — Add an `npm run package` script** that builds and produces a store-ready zip with
      `manifest.json` at the **zip root** (a nested `dist/` folder is rejected on upload).

## B. Policy blockers

- [x] **B1 — Self-host the two web fonts.** `src/index.css:19-20` `@import`s Space Grotesk and
      JetBrains Mono from `fonts.googleapis.com`. That CSS is bundled into the content script, which
      runs on `<all_urls>` — so every page visit fires a request to a third party, and on any site
      with a strict `style-src`/`font-src` CSP the fonts fail and the palette falls back to the
      page's own font. Download the `.woff2` files, ship them, and declare them in
      `web_accessible_resources`.
- [x] **B2 — Privacy policy.** Mandatory: the extension stores an OpenAI API key and transmits tab
      titles/URLs. Needs a `PRIVACY.md` and a hosted URL for the dashboard.

## C. Metadata hygiene

- [x] **C1 — Reconcile the license.** `package.json` says `ISC`; `LICENSE` and `README.md` say MIT.
      Set `package.json` to MIT and fill in the empty `author` field.

## D. Submission artefacts

- [x] **D1 — Store icon**: a 128×128 PNG, uploaded separately from the manifest icons.
- [x] **D2 — Screenshots**: the four captures in `screenshots/` are 3022×1498; the store accepts only
      exactly 1280×800 or 640×400. Centre-crop to 1280×800 with PixelFit — at that ratio the crop is
      horizontal-only and the palette stays fully visible.
- [x] **D3 — Listing copy**: single-purpose description, detailed description, category.
- [x] **D4 — Permission justifications**: one per permission, plus the broad-host-access rationale.
      `<all_urls>` is the one that draws reviewer scrutiny.
- [x] **D5 — Data-usage disclosures**: the three Limited Use certifications.

# Claude's execution summary

All 13 items are done. `npm test` passes (121 tests, 14 files) and `npm run typecheck` is clean.

## Icons and screenshots (A1, A4, D1, D2)

The 1024×1024 master moved from `public/icon.png` to `src/assets/icon.png` — anything left in
`public/` is copied verbatim into `dist/`, so the old location was shipping a 1.5 MB PNG in the
store package to serve a 16px toolbar button. `public/icons/` now holds the four generated sizes
(28 KB in total).

Generation is scripted, not manual, so a new master icon or a new capture does not mean redoing this
by hand: `scripts/generate-store-assets.py` drives PixelFit (`resize_image` for icons,
`change_aspect_ratio` for screenshots) and writes all nine files. Run it with:

```bash
cd ../PixelFit && PYTHONPATH=. uv run python ../steroid/scripts/generate-store-assets.py
```

`PYTHONPATH` is needed because PixelFit is a Streamlit app rather than an installed package — its
`pixelfit/` module is importable only from its own root.

Screenshots use `BackgroundFill.CROP` rather than a letterbox fill. At the source ratio (3022×1498)
cover-scaling puts the height at exactly 800, so the crop is purely horizontal and takes 167px off
each side — well clear of the centred palette. Verified visually, not just arithmetically.

## Fonts (B1) — implemented differently to the plan

The plan proposed `web_accessible_resources`. That would not have worked. `index.css` is imported
with `?inline` and injected as a raw string into the shadow root, so a relative `url()` in it
resolves against the **host page's** origin, not the extension's — every font would 404 on every
site. `web_accessible_resources` plus `chrome.runtime.getURL()` would fix the origin but needs the
CSS rewritten at runtime, and a `chrome-extension://` font is still subject to the host page's
`font-src` CSP.

Base64 `data:` URIs avoid all of it. Both families turned out to be **variable** fonts, so the
`latin` subset is a single file per family covering the whole 400–700 range: 53 KB on disk, ~73 KB
inlined. `build.assetsInlineLimit` in `vite.config.ts` is raised to 64 KB to force Vite to inline
them rather than emit separate assets.

Verified against the built bundle: `dist/content.js` contains exactly two `data:font/woff2;base64`
URIs and zero references to `fonts.googleapis.com` or `fonts.gstatic.com`. `content.js` grew from
259 KB to 331 KB, which is the fonts' weight and is the correct trade for removing a third-party
request from every page load. Only the `latin` subset ships; anything outside its `unicode-range`
falls through to the stack in `tailwind.config.js`, which is the right behaviour for the occasional
non-latin tab title. Licensing is recorded in `src/assets/fonts/README.md` — both faces are OFL 1.1,
which permits bundling and does not affect this repo's MIT license.

## Privacy policy (B2)

Drafted by a subagent against the actual source, then corrected here after the font change. It found
three things the audit brief had wrong, all now reflected in `PRIVACY.md`:

1. `validateApiKey()` hits a **second** OpenAI endpoint (`GET /v1/models`) when a key is first saved.
2. There are **two** storage keys, `tabHistory` and `tabAccessTimes`, not one.
3. The persisted history stores only `tabId`/`windowId`/`timestamp` — no titles or URLs. That is a
   stronger privacy claim than the brief assumed, and it is the accurate one.

Section 4.2 originally disclosed the Google Fonts request as an unavoidable leak; with the fonts now
bundled it was rewritten to state positively that no font host is contacted.

## Manifest, metadata, packaging (A2, A3, A5, C1)

Manifest declares 16/32/48/128 and the inert `content_scripts[0].type: "module"` key is gone.
`package.json` is MIT with an author and real keywords. `npm run package` builds and emits
`steroid-<version>.zip` with `manifest.json` at the archive root — verified with `unzip -l`; the
archive is 165 KB (377 KB uncompressed) across 8 files. `.DS_Store` was being copied out of `public/`
into `dist/` and into the zip; it is deleted and now gitignored, along with the generated zips.

## Follow-up round (post-review)

Three items raised after the first pass, all done.

**Version drift is now impossible, not merely guarded.** Chrome reads the version from
`manifest.json`; the archive was previously named from `package.json`. Bumping one and forgetting
the other would have produced `steroid-1.0.1.zip` containing a `1.0.0` manifest, which the store
rejects as "version already exists" — a confusing error for what is a typo. `package.json` is now
the single source of truth: `scripts/sync-manifest-version.ts` (a build plugin, running on
`closeBundle` so it lands *after* Vite copies `publicDir`) writes that version into
`dist/manifest.json`, and `scripts/package-extension.mjs` names the archive from the built manifest
rather than from `package.json`. The label and the contents therefore cannot disagree.

Verified end to end by bumping `package.json` to 1.0.1 alone, leaving `public/manifest.json` at
1.0.0: the build reported the sync, `dist/manifest.json` came out 1.0.1, and the archive was named
`steroid-1.0.1.zip`. Reverted afterwards.

The packaging script also replaced the inline shell one-liner, which had a latent bug: `zip` appends
to an existing archive rather than replacing it, so any file deleted since the previous package would
have been carried silently into the next upload. It now removes the archive first.

**`minimum_chrome_version: "100"`.** A deliberate margin rather than a computed floor — the binding
constraints are `chrome.tabGroups` (89), ES-module service workers (91) and
`chrome.scripting.executeScript`'s `func` parameter (93). Chrome 100 shipped in March 2022, so the
margin costs essentially no real users and avoids asserting a precise minimum that has not been
tested against an actual old build.

**Listing now pre-empts the "doesn't work" reviews.** The palette cannot open on the New Tab page,
`chrome://` pages, the Web Store or other extensions' pages, because Chrome runs no content script
there — the single most common source of one-star reviews for palette extensions. The detailed
description in `store-assets/listing.md` now says so plainly, and explains the "Allow access to file
URLs" toggle needed for `file:///` tabs.

## Listing copy (D3, D4, D5)

`store-assets/listing.md` holds every dashboard field ready to paste: title, summary, detailed
description, single-purpose statement, a justification for each of the five permissions plus the
`<all_urls>` rationale, and the data-usage answers with the three Limited Use certifications.

# Issues:
- [ ] **Screenshots contain personal data.** The four captures show real tab titles and URLs,
      including local file paths (`file:///Users/amankhandelwal/Projects/narratr/docs/research-plan.md`)
      and private-looking repository names. These become permanently public on the listing. Recapture
      with a deliberately neutral set of tabs, then re-run the generator — the pipeline is in place,
      this is only a matter of new source images.
- [ ] **Privacy policy URL is not yet live.** `listing.md` points at the `main`-branch GitHub blob
      URL, which only resolves once `PRIVACY.md` is pushed. Confirm it loads in a logged-out window
      before submitting.
- [ ] **The self-hosted fonts have not been verified in a real browser.** The bundle is correct and
      the data URIs are present, but nobody has loaded the unpacked extension and confirmed the
      palette still renders in Space Grotesk / JetBrains Mono. Worth one reload of `dist/` and a
      Shift+Shift on any page.
- [ ] **`SearchCommand.execute()`'s dead engine-prefix parser — removed, awaiting your check.** Verified unreachable
      before deleting: `command.execute()` has exactly one production call site
      (`CommandRegistry.executeCommand`, `src/commands/CommandRegistry.ts:68`), reached from three
      places, all closed for this command. `handleActionItem`
      (`src/components/CommandPaletteNew.tsx:111`) dispatches to the registry only for row ids ending
      `-suggestion`, and `SearchCommand` emits exactly one id shape, `search-engine-<shortcut>`;
      command mode is entered only for `mode === 'CommandMode'` commands, and this one is
      `SingleExecution`; the pending-input path re-enters a command whose `execute` already ran once,
      which this one cannot. `getSearchResults` is likewise gated behind `currentCommand && commandMode`
      (`src/hooks/useCommandPalette.ts:177`).

      `execute` and `getSearchResults` are abstract on `BaseCommand`, so neither method could simply
      be removed. `execute` now searches the default engine with the whole argument — the one
      unsurprising behaviour if that routing ever changes — and the prefix parsing that contradicted
      the on-screen rows is gone. Five tests added: three on `execute`'s behaviour, two locking the
      structural facts that keep it unreachable. The regression guard was mutation-tested by
      re-introducing the parser, which failed exactly the intended test and nothing else.

- [ ] Add Issues here
