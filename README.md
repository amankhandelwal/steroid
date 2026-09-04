# Steroid

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command palette for your browser, inspired by the power-user workflows of tools like IntelliJ and VS Code. Steroid gives you a quick, keyboard-first way to interact with your browser tabs.

![Steroid Demo](https://place-holder.com/gif/steroid-demo.gif) 
*(TODO: Add a GIF of the extension in action)*

## Features

Press `Shift+Shift` on any page to open the palette. Start typing to fuzzy-search your open tabs by
title or URL; results are ordered by how recently you visited each tab, so the one you want is
usually already first. Commands appear in the same list once you start typing.

The palette renders in its own Shadow DOM and swallows the keystrokes you type into it, so a site's
own single-letter hotkeys (GitHub's `s`, `t`, `g c`) won't fire behind it.

### Commands

Every command is matched on any of its aliases, so type whichever you remember.

| Command | Type | What it does |
| --- | --- | --- |
| **Search** | `search`, `s`, `find` | Lists every configured search engine for your query — arrow to one and press Enter |
| **Open** | `open`, `url`, `navigate` | Opens a URL in a new tab |
| **New Tab** | `new tab`, `new`, `nt`, `tab` | Opens a new tab in the current window |
| **Previous Tab** | `previous`, `prev`, `previous tab`, `prev tab` | Jumps back to the last active tab, showing its title before you commit |
| **Close Current Tab** | `close current`, `current` | Closes the active tab |
| **Close Tabs** | `close tabs`, `close multiple`, `multi close` | Multi-select several tabs, then close them together |
| **Close Duplicate Tabs** | `close duplicates`, `duplicate` | Keeps one copy of each unique URL, closes the rest |
| **Group Tabs** | `group tabs`, `group`, `create group` | Multi-select tabs and put them in a named group |
| **Delete Tab Group** | `delete group`, `ungroup`, `remove group` | Dissolves one group; its tabs stay open |
| **Ungroup All Tabs** | `ungroup all`, `remove all groups`, `disband` | Dissolves every group across all windows |
| **Smart Group Tabs (AI)** | `smart group`, `ai group`, `auto group`, `smart` | Sorts your tabs into named groups and windows using OpenAI — needs an API key |
| **Set OpenAI API Key** | `api key`, `openai`, `settings` | Stores your own OpenAI key locally, for Smart Group |

Search engines are configured in [`src/config/searchEngines.json`](src/config/searchEngines.json) —
Google, DuckDuckGo, Bing, YouTube, GitHub, Stack Overflow, Wikipedia and Reddit ship by default, and
adding your own is a matter of a name, a query URL and a shortcut.

### Keyboard reference

| Key | Action |
| --- | --- |
| `Shift` `Shift` | Open the palette |
| `↑` / `↓` | Move through results |
| `Home` / `End` | Jump to first / last result |
| `PageUp` / `PageDown` | Move a page at a time |
| `Enter` | Switch to the highlighted tab, or run the highlighted command |
| `` ` `` | Close the highlighted tab, leaving the palette open |
| `Tab` | Enter command mode for the highlighted command |
| `Esc` | Leave command mode, or close the palette |
| `Ctrl`+`A` | Select all *(command mode)* |
| `Ctrl`+`D` or `Delete` | Clear selection *(command mode)* |
| `Shift`+`Enter` or `Ctrl`+`Enter` | Run the command on the current selection *(command mode)* |

Typing at any point returns focus to the search box, so you never have to reach back up to it.

### Where it works

The palette opens on ordinary web pages. Chrome forbids extensions from running on its own internal
pages, so `Shift+Shift` does nothing on the New Tab page, `chrome://` pages, the Chrome Web Store, or
other extensions' pages — no extension can work around that. For `file:///` URLs, enable
"Allow access to file URLs" on the extension's Details page in `chrome://extensions`.

## Getting Started

To use this extension, you can load it locally in a Chromium-based browser (like Google Chrome, Brave, or Edge).

1.  **Download the code**: Clone this repository to your local machine.
    ```bash
    git clone https://github.com/amankhandelwal/steroid.git
    ```
2.  **Build the extension**: You need to have Node.js and npm installed.
    ```bash
    cd steroid
    npm install
    npm run build
    ```
    This will create a `dist` directory containing the production-ready extension files.

3.  **Load the extension in your browser**:
    -   Navigate to `chrome://extensions` (or the equivalent in your browser).
    -   Enable **"Developer mode"** (usually a toggle in the top-right).
    -   Click **"Load unpacked"**.
    -   Select the `dist` folder that was created in the previous step.

The extension is now installed! Go to any website and press `Shift+Shift` to try it out.

## Development

We welcome contributions! If you want to develop and contribute to Steroid, here's how to set up your environment.

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Run the development server**:
    ```bash
    npm run dev
    ```
    This command starts Vite in watch mode. Any changes you make to the source code will be automatically rebuilt. To see your changes, you may need to reload the extension from the `chrome://extensions` page.

3.  **Build a store package**:
    ```bash
    npm run package
    ```
    Builds and writes `steroid-<version>.zip` with `manifest.json` at the archive root, which is the
    layout the Chrome Web Store requires.

    To release a new version, bump `version` in **`package.json` only** — the build writes it into
    `dist/manifest.json`, and the archive is named from that, so the label and the manifest can never
    disagree.

4.  **Regenerate image assets** (icons and store screenshots) after changing `src/assets/icon.png` or
    adding a capture to `screenshots/`. This uses [PixelFit](https://github.com/amankhandelwal/PixelFit),
    checked out alongside this repo:
    ```bash
    cd ../PixelFit && PYTHONPATH=. uv run python ../steroid/scripts/generate-store-assets.py
    ```

## Privacy

Steroid has no server, no analytics and no telemetry. Everything runs locally in your browser.

The single exception is opt-in: the **Smart Group** command sends your tab titles and URLs to OpenAI
using an API key you supply yourself. If you never set a key, Steroid makes no network requests at
all — the two webfonts it uses are bundled in the extension rather than fetched from a CDN.

Full details in [PRIVACY.md](PRIVACY.md).

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

## License

Distributed under the MIT License. See `LICENSE` for more information.