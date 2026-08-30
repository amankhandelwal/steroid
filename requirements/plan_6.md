# The Plan

Fix a single user-reported bug: **keystrokes typed into the Steroid palette leak through to the
underlying website and trigger that site's own keyboard shortcuts.** Reported on github.com — with
the palette open, typing into the search box fires GitHub's single-letter hotkeys (`s` focuses
GitHub's search, `t` opens the file finder, `g c` navigates, `/` focuses search, …), so the page
navigates out from under the palette while the user is still typing.

Desired behaviour, in the user's words: once the palette is opened (Shift+Shift), **every key press
belongs to the palette and only the palette**, until the palette is escaped/closed.

This is a bug-fix plan, not a feature plan. The root cause below was verified by reading the actual
code paths, not inferred from the symptom. Verify it against the cited lines before changing
anything (line numbers may drift), then fix it.

---

# Root cause

**It is not a focus bug. It is shadow-DOM event retargeting.**

The palette renders inside a shadow root whose host is a plain `<div id="steroid-host">` appended to
`document.body` (`src/content.tsx:21-31`). Keyboard events are `composed: true`, so a `keydown`
originating on the palette's `<input>` does **not** stop at the shadow boundary: it escapes and keeps
bubbling `#steroid-host → body → html → document → window`. On the way out the browser
**retargets** it — every listener above the shadow boundary sees `event.target === #steroid-host`,
a bare `<div>`, not the input the user actually typed into.

GitHub's hotkey layer (`github/hotkey`) listens on `document` in the **bubble** phase and ignores
events whose target is a form field. A retargeted `<div>` is not a form field, so GitHub concludes
"the user pressed `s` while not typing" and runs its shortcut. Every site with global single-key
shortcuts behaves the same way.

Three properties of the current code make this unavoidable rather than accidental:

1. **The palette's own key handling is registered above the shadow boundary.**
   `src/hooks/useKeyboardNavigation.ts:84` does `document.addEventListener('keydown', …)`. By the
   time that listener runs, the event has already traversed `body` and every earlier-registered
   `document` listener. Worse, `stopPropagation()` does not stop *other* listeners attached to the
   same node (`document`) — that would need `stopImmediatePropagation()` — and page scripts get to
   register on `document` first, because the content script has no `run_at` and therefore defaults
   to `document_idle` (`public/manifest.json:19-25`).

2. **Plain character keys are never stopped at all.** `KeybindingManager.handleKeyEvent`
   (`src/keybindings/KeybindingManager.ts:85-104`) only calls `preventDefault`/`stopPropagation`
   when some registered handler matches *and* returns `false`. Letters have no handler — they are
   meant to fall through into the search input — so nothing stops them. Letters are exactly what
   trips site hotkeys.

3. **Only `keydown` is considered.** `keypress` and `keyup` are never intercepted anywhere, so a
   site binding on those leaks even for keys the palette does handle.

Note the corollary: this leak happens **regardless of where focus is**. Fixing focus alone would not
fix it, and stopping the event anywhere at-or-above `document` is too late. The event has to be
stopped **at the shadow host**, which is the last node it passes through before the page can see it.

---

# Technical requirements

## FIND-031 (P0) — Seal key events at the shadow host

**Change:** stop `keydown`, `keypress` and `keyup` at `#steroid-host` in the **bubble** phase, so no
key event originating inside the palette ever reaches `body`, `document` or `window`.

**Bubble phase, not capture — this is the critical detail.** The event path for a keystroke on the
palette input is:

```
capture:  window → document → html → body → #steroid-host → (shadow root) → … → input
bubble:   input → … → (shadow root) → #steroid-host → body → html → document → window
```

A **capture** listener on the host fires *before* the event descends into the shadow tree, so
stopping there would break the palette's own input. A **bubble** listener on the host fires after
the palette has fully handled the event and before the page sees it. That is the seal.

**New file:** `src/content/eventContainment.ts` — DOM plumbing, no React, no palette knowledge.

```ts
/** Key events that must never escape the palette into the host page. */
const CONTAINED_KEY_EVENTS = ['keydown', 'keypress', 'keyup'] as const;

/**
 * Stop key events originating inside the palette's shadow tree from reaching the
 * host page. Returns a disposer that removes the listeners.
 */
export function sealKeyEventsAtHost(host: HTMLElement): () => void
```

- Register each listener on `host` with `{ capture: false }` and call `event.stopPropagation()`.
- Do **not** call `preventDefault()` — the palette's input still needs its default typing
  behaviour, and the palette's own handlers already `preventDefault()` the keys they consume.
- Do **not** call `stopImmediatePropagation()` — nothing else of ours listens on the host node, and
  it buys nothing over `stopPropagation()` here.
- Attach unconditionally at mount, not only while the palette is open: when the palette is closed
  the shadow tree is empty, so no key event can originate there and the seal is inert. This keeps
  the seal free of open/closed state, which is one less thing to get out of sync.

**Wire-up:** `src/content.tsx` calls `sealKeyEventsAtHost(host)` immediately after
`host.attachShadow(...)`, inside `mountSteroid()`. Keep `mountSteroid` short — one call, one
comment pointing at the retargeting explanation above.

**Verification:** load the unpacked extension, open github.com, press Shift+Shift, and type
`s`, `t`, `g`, `c`, `/`, `.` and `?` into the palette. The characters must appear in the palette's
search box and GitHub must not navigate, open its command bar, or focus its own search. Repeat on
one more hotkey-heavy site (gmail.com or youtube.com) with `j`/`k`/`e`.

## FIND-032 (P0) — Move the palette's key handling inside the shadow tree

FIND-031's seal is applied at the host; the palette's own listener currently sits on `document`,
*above* the seal, so after FIND-031 it would stop receiving events entirely. It has to move below
the boundary. This is not incidental cleanup — FIND-031 is incorrect without it.

**Change:** `src/hooks/useKeyboardNavigation.ts` takes the palette's container element instead of
listening globally.

- Add `containerRef: RefObject<HTMLElement | null>` to `UseKeyboardNavigationProps`.
- Replace `document.addEventListener('keydown', handleKeyDown)` with
  `containerRef.current?.addEventListener('keydown', handleKeyDown)`, and mirror it in the cleanup.
- Guard for `containerRef.current === null` on first run and re-run the effect once it is set.
- The `if (!props.isModalOpen) return;` early-exit stays — it is now belt-and-braces, since the
  container only exists while the palette is mounted.

`src/components/CommandPaletteNew.tsx` already has the backdrop element; give it a
`backdropRef` (`useRef<HTMLDivElement>(null)` on the `.steroid-palette-backdrop` div, line ~309) and
pass it as `containerRef` into `useKeyboardNavigation` (call site line ~241). Every key event from
the input bubbles through the backdrop, so no behaviour changes for the user.

**Leave `App.tsx`'s Shift+Shift listener on `document`** (`src/App.tsx:38`). It must fire when the
palette is closed and no palette element exists; it already no-ops while the palette is open
(`isOpenRef.current` guard, line 24), and the FIND-031 seal means it simply stops seeing Shift
presses made inside the palette — which is correct.

**Verification:** with the palette open, confirm ↑/↓, Home/End, PageUp/PageDown, Enter, Shift+Enter,
Tab, Escape, backtick and Ctrl+A still work exactly as before. `npm test` must still pass
`tests/keybindings/SelectionKeys.test.ts` unchanged (it tests the manager, not the listener site).

## FIND-033 (P1) — Keep focus inside the palette while it is open

FIND-031 seals events that *originate* in the palette. If the page steals focus while the palette is
open — sites do this on load, on async render, on their own hotkeys — subsequent keystrokes
originate on a page element, never pass through the host, and are not sealed. The user's stated
requirement ("the focus is on the plugin … until I've escaped/closed the popup") needs an explicit
guard.

**New file:** `src/utils/focusContainment.ts` — pure DOM logic, no React:

```ts
/**
 * Keep focus inside `host`'s shadow tree. Whenever focus lands anywhere else,
 * `refocus` is invoked to pull it back. Returns a disposer.
 */
export function containFocus(host: Element, refocus: () => void): () => void
```

- Listen for `focusin` on `document` with `{ capture: true }`.
- Detection rule: when any node inside a shadow tree holds focus, `document.activeElement` is that
  tree's **host element**. So the check is simply `document.activeElement !== host` → focus escaped
  → call `refocus()`. This sidesteps having to walk `composedPath()`.
- Re-entrancy guard: `refocus()` itself fires `focusin`; that re-entrant call will see
  `activeElement === host` and stop, but add an explicit in-flight boolean so a page that
  synchronously fights for focus cannot produce an unbounded loop. If more than a small number of
  consecutive refocus attempts happen inside one task, give up until the next task.

**New file:** `src/hooks/useFocusContainment.ts` — thin React wrapper:

```ts
/** Keeps focus pinned to the palette while it is mounted. */
export function useFocusContainment(
  containerRef: RefObject<HTMLElement | null>,
  refocus: () => void
): void
```

Resolve the host from the container without prop-drilling:
`containerRef.current?.getRootNode()` returns the `ShadowRoot`, whose `.host` is `#steroid-host`.
Bail out cleanly when the root node is not a `ShadowRoot` (tests, or any future non-shadow mount).

`CommandPaletteNew` calls `useFocusContainment(backdropRef, () => inputRef.current?.focus())`. This
replaces nothing — the existing auto-focus-on-mount effect (line ~266) stays as the initial focus.

**Verification:** open the palette on github.com, click on the page background behind the palette,
and confirm focus snaps back to the palette input and typing still does not reach GitHub. Press
Escape and confirm focus is released back to the page and GitHub's hotkeys work normally again.

## FIND-034 (P1) — Test coverage

Existing tests run under `environment: 'node'` (`vitest.config.ts`) and there is **no** `jsdom` or
`happy-dom` installed. What FIND-031 and FIND-033 do is fundamentally DOM event propagation, which
node's bare `EventTarget` cannot model (no shadow trees, no retargeting).

**Decision needed from the user before this section is executed** (repo rule: no dependency changes
on my own):

- **Option A (recommended): add `jsdom` as a devDependency** and give the new tests
  `// @vitest-environment jsdom`, leaving the global default at `node` so no existing test changes.
  This is the only way to test the actual bug — real host/shadow-root/input nesting, a real
  `document`-level listener standing in for GitHub's, and an assertion that it never fires.
  Tests to add:
  - `tests/content/eventContainment.test.ts`
    - a `keydown` dispatched from an input inside the shadow tree reaches a listener inside the
      shadow tree, and does **not** reach a `document`-level bubble listener — this is the
      regression test for the reported bug;
    - the same for `keypress` and `keyup` (FIND-031's third property);
    - a `keydown` dispatched from an element *outside* the host still reaches `document` — the seal
      must not blanket-swallow the page's own events;
    - the disposer removes the listeners.
  - `tests/utils/focusContainment.test.ts`
    - focus moving to an element outside the host invokes `refocus`;
    - focus inside the host does not;
    - a page that re-steals focus on every `focusin` does not spin forever;
    - the disposer detaches.
- **Option B: no new dependency.** Test `sealKeyEventsAtHost` against a hand-rolled fake element
  that records `addEventListener` calls, asserting the registered handlers call `stopPropagation`
  for exactly the three key events and are removed by the disposer. This verifies the wiring but
  **not** the propagation behaviour that is the actual bug, so the regression could silently return.

Do not weaken `tsconfig.json` or the `node` default environment to make either option work.

## Out of scope (deliberate residual)

A site listening on `document` or `window` in the **capture** phase still sees palette keystrokes,
because capture runs top-down and reaches those nodes *before* `#steroid-host`. Closing that gap
requires the content script to register a window-capture listener before any page script runs, i.e.
`"run_at": "document_start"` in `public/manifest.json` plus deferred mounting (at `document_start`,
`document.body` does not exist yet). GitHub — and the common hotkey libraries generally — bind in
the bubble phase, so this is not needed for the reported bug. **The user has explicitly decided to
skip this for now.** Do not add it. If a site is later found that still leaks, this is the fix, and
it should be its own plan.

---

# Execution order

1. FIND-031 (`src/content/eventContainment.ts`, `src/content.tsx`)
2. FIND-032 (`src/hooks/useKeyboardNavigation.ts`, `src/components/CommandPaletteNew.tsx`) — must
   land in the same change as FIND-031; the palette's keyboard navigation is broken between them.
3. FIND-033 (`src/utils/focusContainment.ts`, `src/hooks/useFocusContainment.ts`,
   `src/components/CommandPaletteNew.tsx`)
4. FIND-034 (tests — after the user answers the jsdom question)
5. `npm run typecheck`, `npm test`, `npm run build` — all three must pass before reporting done.

No CSS changes are needed (no new components are rendered), so no new `.css` files.

# Claude's role
You are a senior software engineer who is extremely cynical about writing clean, modular, re-usable and production level code.
- You follow clear separation of concern.
- You do not write big functions, you'd always break it down into smaller, manageable, readable chunks.
- You always use Types and short & clear documentation on functions.
- Business logic should be ideally separated from UI/DOM elements

# Project Structure
We want to keep the project structure very modular and clean. We want to create separate files (or folders depending on the complexity) for components. Each component would have their dedicated stlying i.e. a dedicated CSS file (not a common one). Business logic should be ideally separated from UI/DOM elements

# Claude's execution summary

All four findings implemented as specified. `npm run typecheck`, `npm test` (121 tests, 14 new) and
`npm run build` all pass.

**FIND-031 — seal at the shadow host.** New `src/content/eventContainment.ts` exports
`sealKeyEventsAtHost(host): () => void`, which registers bubble-phase listeners for `keydown`,
`keypress` and `keyup` on the host and calls `stopPropagation()` on each. No `preventDefault()` (the
input still needs to type) and no `stopImmediatePropagation()` (nothing else of ours is on that
node). The module header carries the retargeting explanation so the "why bubble, not capture"
constraint cannot be silently undone later. `src/content.tsx` calls it once, right after
`attachShadow`, unconditionally — the seal is inert while the palette is closed because an empty
shadow tree emits no key events, so it carries no open/closed state.

**FIND-032 — palette key handling moved below the boundary.** `UseKeyboardNavigationProps` gained a
`containerRef: RefObject<HTMLElement | null>`; the effect in `src/hooks/useKeyboardNavigation.ts`
now attaches `handleKeyDown` to that element instead of `document`, and detaches from the same
captured element on cleanup. `CommandPaletteNew` holds a new `backdropRef` on
`.steroid-palette-backdrop` and passes it in. Every key event from the search input and from
`InputDialog` bubbles through the backdrop, so no keybinding behaviour changed. `App.tsx`'s
Shift+Shift listener was deliberately left on `document`, as planned.

Worth noting for future work: `InputDialog`'s React `onKeyDown` is unaffected — React 19 attaches
its root listener at the `createRoot` container (`#steroid-root`), which sits *inside* the shadow
root, below the seal.

**FIND-033 — focus containment.** New `src/utils/focusContainment.ts` exports `getShadowHost(node)`
(resolves the host from any node in the tree, `null` outside a shadow tree) and
`containFocus(host, refocus): () => void`, which listens for `focusin` on the document in the
capture phase and calls `refocus()` whenever `document.activeElement !== host`. That one comparison
is the whole escape check, courtesy of the retargeting rule that `activeElement` is the host while
anything inside the shadow tree holds focus. The runaway guard is a per-task budget of 5 attempts,
reset on a microtask — a page that re-steals focus synchronously from its own `focusin` handler is
fought five times and then left alone until the next task, so there is no unbounded recursion.
`src/hooks/useFocusContainment.ts` is the React wrapper (keeps `refocus` in a ref so the listener is
not re-attached every render); `CommandPaletteNew` calls it with `backdropRef` and
`() => inputRef.current?.focus()`. The existing auto-focus-on-mount effect is untouched and still
provides the initial focus.

**FIND-034 — tests.** `jsdom@^29.1.1` added as a devDependency (Option A, approved by the user).
The global environment stays `node`; the two new files opt in per-file with
`// @vitest-environment jsdom`, so no existing test or config changed.

| File | Covers |
|------|--------|
| `tests/content/eventContainment.test.ts` (6 tests) | a real host → shadow root → container → input nesting; `keydown`/`keypress`/`keyup` from the input never reach a `document`-level bubble listener standing in for GitHub's hotkey layer; the same events *do* still reach a listener inside the palette; `defaultPrevented` stays false so typing works; events from a page element outside the host still reach `document`; the disposer un-seals |
| `tests/utils/focusContainment.test.ts` (8 tests) | `getShadowHost` inside/outside a shadow tree and on `null`; focus landing on a page element pulls back into the palette; focus moving within the palette is left alone; a page that re-steals focus on every `focusin` does not loop unboundedly; the disposer detaches |

**Files added:** `src/content/eventContainment.ts`, `src/utils/focusContainment.ts`,
`src/hooks/useFocusContainment.ts`, `tests/content/eventContainment.test.ts`,
`tests/utils/focusContainment.test.ts`.
**Files modified:** `src/content.tsx`, `src/hooks/useKeyboardNavigation.ts`,
`src/hooks/index.ts`, `src/components/CommandPaletteNew.tsx`, `package.json` (+ lockfile).
No CSS changes, as planned. The `document_start` hardening remains out of scope per the user's call.

**Please reload the unpacked extension and verify:** on github.com press Shift+Shift and type
`s`, `t`, `g`, `c`, `/`, `.`, `?` — the characters must land in the palette's search box with no
GitHub navigation or search focus; then click the page behind the palette and confirm focus snaps
back; then Escape and confirm GitHub's own hotkeys work normally again. Also re-check ↑/↓,
Home/End, PageUp/PageDown, Enter, Shift+Enter, Tab, Escape, backtick and Ctrl+A inside the palette.

# Issues:
- [ ] Add Issues here
