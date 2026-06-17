# How to release

1. Dev bumps `version` in `package.json`.
2. Dev creates a `release/xyz` (or `hotfix/xyz`) branch and pushes it (**never** target `develop` nor `master`). This single push triggers GitHub Actions to:
   - **Create a draft release** tagged `vX.Y.Z` (read from `package.json`) with auto-generated notes — see [`.github/workflows/release.yml`](.github/workflows/release.yml). Notes are categorized via [`.github/release.yml`](.github/release.yml) by PR label, so labelling merged PRs keeps the changelog tidy.
   - **Build all binaries** (macOS / Windows / Linux), which `electron-builder` attaches to the draft.
   - E.g. if the version is `1.0.0`, the tag is `v1.0.0`.
   - The draft step is idempotent: if a release for that tag already exists it is left untouched, so re-pushing the branch will not clobber a signed draft.
3. Ensure that `.yml` files aren't being left out in the artifacts. These are needed for auto-update to work correctly.
4. Once all binaries have been uploaded to the draft, Dev messages THORCHAIN-ADMIN and they sign and update the draft.
5. Once they are done, publish the release. GitHub will tag the latest commit for you.

## Links

- `GitHub` documentation: ["Managing releases in a repository"](https://help.github.com/articles/creating-releases/)
- `electron-builder` documentation: ["Recommended GitHub Releases Workflow"](https://www.electron.build/configuration/publish#recommended-github-releases-workflow)
