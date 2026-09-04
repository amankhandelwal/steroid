# Bundled fonts

Both files are the `latin` subset of the upstream **variable** font, fetched from Google Fonts'
`fonts.gstatic.com` CDN and vendored here so the extension makes no third-party request at runtime.
See `src/styles/fonts.css` for why.

| File | Family | Version | Upstream |
| --- | --- | --- | --- |
| `space-grotesk-latin.woff2` | Space Grotesk | v22 | https://fonts.google.com/specimen/Space+Grotesk |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | v24 | https://fonts.google.com/specimen/JetBrains+Mono |

Both are licensed under the **SIL Open Font License 1.1**, which permits redistribution as part of a
bundled product. The OFL is separate from, and does not affect, this repository's MIT license — it
covers only the two `.woff2` files in this directory.

- Space Grotesk © Florian Karsten — https://github.com/floriankarsten/space-grotesk
- JetBrains Mono © JetBrains — https://github.com/JetBrains/JetBrainsMono
