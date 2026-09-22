# PWA / WebAPK support

This document explains how the Rsolve GRC frontend is made installable as a
**WebAPK** on Android, and how to package it as a Trusted Web Activity (TWA)
APK/AAB for the Play Store.

## TL;DR — there is no "URL → WebAPK" converter

**WebAPK** is not something you build yourself. When a user taps **Install app**
on an *installable PWA* in Chrome for Android, Chrome sends the manifest to
Google's **WebAPK minting server**, which mints a real, signed Android package
(you'll see it under `Settings → Apps` with package name `org.chromium.webapk.*`)
and installs it. You never touch an APK.

To get an actual `.apk`/`.aab` you can upload to Google Play, Google's
**Bubblewrap** CLI (or the **PWABuilder** web UI) wraps the same PWA as a
**Trusted Web Activity (TWA)**. Both require the site to already be a valid,
installable PWA.

So there are two independent goals:

| Goal | Tool | What you get |
|---|---|---|
| Install from Chrome | none — just a valid PWA | WebAPK minted by Google |
| Play Store listing | Bubblewrap / PWABuilder | TWA `.apk` + `.aab` |

## What is already in this repo

- `public/manifest.webmanifest` — name, 192/512 icons, `start_url`, `scope`,
  `display: standalone`, `theme_color`, shortcuts.
- `public/icons/` — `icon-192`, `icon-512`, `icon-maskable-192/512`,
  `apple-touch-icon-180`.
- `public/sw.js` — app-shell service worker with a `fetch` handler (required by
  Chrome). Navigations are network-first with an offline fallback; same-origin
  static assets are stale-while-revalidate; **API and cross-origin requests are
  never cached**.
- `src/lib/pwa.ts` + `src/hooks/use-install-prompt.ts` +
  `src/components/grc/InstallAppButton.tsx` — service-worker registration and an
  in-app **Install app** button (shown on the Dashboard when Chrome offers the
  install prompt).
- `index.html` — manifest link, `theme-color`, Apple mobile web-app meta tags.

## Path A — test the WebAPK (no build tools)

1. Deploy the app over **HTTPS** (Chrome will not install over plain HTTP, except
   `localhost`).
2. Open it in **Chrome for Android**.
3. Chrome's ⋮ menu → **Install app** / **Add to Home screen**, or tap the in-app
   **Install app** button on the Dashboard.
4. The icon appears on the home screen and opens without browser chrome.

Verify it is a WebAPK (not a shortcut):

```bash
adb shell pm list packages | grep webapk
# org.chromium.webapk.<hash>...
```

Checklist (Chrome DevTools → **Application**):
- **Manifest**: no errors, name + 192/512 icons detected.
- **Service Workers**: `sw.js` is activated and controlling the page.
- **Lighthouse → Installable** passes.

## Path B — build a TWA APK/AAB (Bubblewrap)

Prerequisites: Node 18+, JDK 17, Android SDK build tools (Bubblewrap offers to
install them), and a **custom domain** for the app (see the GitHub Pages caveat
below).

```bash
# Generate the Android project from the live web manifest.
npx @bubblewrap/cli init --manifest=https://<your-domain>/manifest.webmanifest

# Answer the wizard (package id, launcher name, colors, signing key).
# This writes twa-manifest.json + the Android project.

# Build a signed APK + AAB.
npx @bubblewrap/cli build
# → app-release-signed.apk  (sideload/test)
# → app-release-bundle.aab  (upload to Play Console)

# Install directly to a connected device.
npx @bubblewrap/cli install
```

`pwa/twa-manifest.example.json` is a starting point for the wizard's output —
replace `host`, `packageId` and the URLs with your real values. `bubblewrap init`
will generate the authoritative `twa-manifest.json`.

### Digital Asset Links (removes the URL bar)

A TWA only runs full-screen once it can prove it owns the domain. After the app
is uploaded to the Play Console, copy the **SHA-256 signing fingerprint** and
publish it at the **origin root**:

```
https://<your-domain>/.well-known/assetlinks.json
```

Use `pwa/assetlinks.json.example` as the template. Verify at
<https://developers.google.com/digital-asset-links/tools/generator> (or
`https://<your-domain>/.well-known/assetlinks.json`).

### ⚠️ GitHub Pages caveat

The current Pages deploy serves the app from a **project subpath**
(`https://<user>.github.io/<repo>/`). Digital Asset Links must live at the
**domain root** (`https://<user>.github.io/.well-known/assetlinks.json`), which a
project page cannot control. So:

- **Path A (WebAPK install from Chrome)** works fine on the Pages URL — no
  assetlinks required.
- **Path B (TWA/Play Store)** needs a **custom domain** (or a root-served host)
  so `/.well-known/assetlinks.json` resolves.

## Alternative GUI: PWABuilder

<https://www.pwabuilder.com> packages the same PWA with Bubblewrap in the cloud
and returns a zip containing the `.apk` and `.aab` — useful if you don't want to
install the Android SDK locally.

## Notes on caching

`sw.js` bumps its cache name (`rsolve-grc-shell-v1`) on each release; old caches
are deleted on activation. To force an update, increment `CACHE_NAME`. The
worker never caches `/api` or cross-origin traffic, so tenant data is not stored
in the Cache Storage.
