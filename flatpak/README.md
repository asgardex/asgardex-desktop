# Flatpak / Flathub (draft)

App id: **`com.asgardex.Asgardex`** (domain: [asgardex.com](https://asgardex.com/)).

This is a **draft Path A** manifest for **local testing and future Flathub work**. A **source-build** (or an **approved Flathub exception**) will be required for an official Flathub submission. The `.deb`-based Path A layout here is packaging infrastructure, not a ready-to-submit Flathub PR.

## Two packaging paths

| Path | What | Use |
|------|------|-----|
| **electron-builder** | `yarn package:electron` → `release/ASGARDEX-*-linux.flatpak` | Direct installs / GitHub Releases (current CI) |
| **Draft Path A manifest** | `flatpak/com.asgardex.Asgardex.yml` | Local Flathub-style builds (unpack release `.deb`); not the official submission path yet |

Flathub does **not** accept uploading the electron-builder `.flatpak` bundle. An official listing needs a **manifest** that meets [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements) (typically a full source build for source-available apps, unless maintainers get a documented exception).

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

## Submitting to Flathub

1. Upstream: merge this app id, metainfo, and stable Linux deb releases.
2. Add screenshots URLs to `resources/linux/com.asgardex.Asgardex.metainfo.xml`.
3. Fork [flathub/flathub](https://github.com/flathub/flathub), base branch **`new-pr`** (not `master`).
4. Copy into the submission (paths flattened for Flathub repo layout):
   - `com.asgardex.Asgardex.yml`
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
