# Flatpak / Flathub (draft)

App id: **`com.asgardex.Asgardex`** (domain: [asgardex.com](https://asgardex.com/)).

> **Draft status:** This is a draft Path A manifest for **local testing and future Flathub work**. A **source-build** (or an **approved exception**) will be required for an official Flathub submission. The checklist and steps below are retained as practical guidance for that future work; they do not mean this `.deb`-based layout is already the accepted store path.

## Two packaging paths

| Path | What | Use |
|------|------|-----|
| **electron-builder** | `yarn package:electron` → `release/ASGARDEX-*-linux.flatpak` | Direct installs / GitHub Releases (current CI) |
| **Draft Path A manifest** | `flatpak/com.asgardex.Asgardex.yml` | Local Flathub-style builds (unpack release `.deb`); foundation for a later Flathub PR |

Flathub does **not** accept uploading the electron-builder `.flatpak` bundle. Official listing still needs a **manifest** Flathub CI can build. For a source-available app that usually means a **from-source** recipe (or a documented exception); Path A here is for local iteration and packaging infra, not a claim that the release `.deb` is already Flathub-ready.

## Verification (after Flathub accepts the app)

Publish the verification token at:

```text
https://asgardex.com/.well-known/org.flathub.VerifiedApps.txt
```

(Token comes from the Flathub developer portal once the app is live.)

## Local test of the draft Flathub manifest

```bash
# Tooling
flatpak install -y flathub org.flatpak.Builder
flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y flathub \
  org.freedesktop.Platform//24.08 \
  org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08

cd flatpak
flatpak run --command=flathub-build org.flatpak.Builder --install com.asgardex.Asgardex.yml
flatpak run com.asgardex.Asgardex

# Lint
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest com.asgardex.Asgardex.yml
```

Inspect the release deb layout if install fails:

```bash
dpkg-deb -c ASGARDEX-*-linux.deb | head -50
```

## Submitting to Flathub (when ready — not this draft alone)

Before opening an official Flathub PR, plan either a **from-source** module set or an **approved exception** for binary/extra-data packaging. The steps below remain the practical process once that packaging approach is settled:

1. Upstream: merge this app id, metainfo, and stable Linux deb releases.
2. Add screenshots URLs to `resources/linux/com.asgardex.Asgardex.metainfo.xml`.
3. Fork [flathub/flathub](https://github.com/flathub/flathub), base branch **`new-pr`** (not `master`).
4. Copy into the submission (paths flattened for Flathub repo layout):
   - `com.asgardex.Asgardex.yml` (or the future source-build manifest)
   - `flathub.json`
   - `asgardex.sh`
   - metainfo + desktop (as local `file` sources)
   - icons / LICENSE as needed
5. Adjust `path:` sources (Flathub has no monorepo parent dirs — use local files only).
6. Open PR titled **`Add com.asgardex.Asgardex`**.
7. Address review; reviewers run `bot, build`.

Docs: [Submission](https://docs.flathub.org/docs/for-app-authors/submission) · [Requirements](https://docs.flathub.org/docs/for-app-authors/requirements)

## App id rename notes

Previous electron-builder / local Flatpak id: `org.thorchain.asgardex`.

- New sandbox: `~/.var/app/com.asgardex.Asgardex/`
- finishArgs + `storageMigration.ts` import once from host stores:
  - Keystore: `~/.config/ASGARDEX` (deb/AppImage) and legacy Flatpak `…/org.thorchain.asgardex/config/ASGARDEX`
  - Vultisig: host `~/.vultisig` (SDK default) into sandbox `…/ASGARDEX/vultisig`
- If both native and legacy keystore trees have wallets, the **newest** `wallets.json` (mtime) wins; same idea for vault trees (`vault:*.json`). Copies are atomic (staging + rename). Separate markers so keystore and Vultisig can succeed/fail independently.
- On Flatpak, the SDK is reconfigured to `FileStorage({ basePath: APP_DATA_DIR/vultisig })` so the live store is writable without RW host access.
