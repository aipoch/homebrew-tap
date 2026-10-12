# Contributing to the AIPOCH Homebrew tap

Submit changes as pull requests against `main`. Use a branch named
`<type>/<short-description>` and Conventional Commit subjects with a scope, for example:

```text
chore(open-science): update runtime to 0.38.0
```

Use the same format for the pull request title. AIPOCH maintainers push branches to
this repository directly.

## Update a Formula

1. Choose a published stable [Open Science release](https://github.com/aipoch/open-science/releases)
   with all four standalone CLI archives and its `SHA256SUMS.txt`.
2. Update `release_version` and all four `sha256` values in `Formula/open-science.rb`.
   Match each checksum to its macOS/Linux and ARM64/x64 archive. Use versioned Release
   URLs and retain the published bytes.
3. Download the archives and independently verify their checksums against the Release
   checksum file and GitHub asset digests.
4. Run the checks below and open a pull request with the release link and validation results.
   Wait for all four native CI runners to pass before merging.

The tap uses reviewed Formula updates. Open Science releases and the desktop Cask
are maintained separately; no cross-repository publication credentials are required.

## Validate changes

```sh
brew style Formula/open-science.rb
brew audit --strict --online aipoch/tap/open-science
node scripts/test-upgrade.mjs
```

Run installation tests in a disposable registered tap checkout without an existing
Open Science Formula installation. Node.js is needed for the maintainer test scripts;
it is bundled with the user installation.

For a developer machine with an existing npm command link:

```sh
OPEN_SCIENCE_BREW_TEST_SKIP_LINK=1 node scripts/test-upgrade.mjs
```

This option preserves the existing command and upgrades through
`brew install --skip-link`. Clean CI runners test normal global linking and
`brew upgrade`.

The harness installs the current release, starts its backend, accesses the Web UI,
creates a project in an isolated profile, and applies a temporary Formula revision
bump. It then checks the upgraded installation and retained project, stops the backend,
and verifies data retention after uninstall. It restores the original Formula and
preserves a failed verification profile for inspection. Historical application-version
migrations are not covered by this revision test.

CI covers macOS/Linux on ARM64/x64. Use the workflow's manual runner input for a
focused dry-run before repeating the complete matrix. During PR debugging, the
repository variable `FORMULA_DRY_RUN_RUNNER` can temporarily select one runner;
delete it and rerun all four runners before merging.

## Preserve macOS signatures

The Formula preserves upstream `@rpath` IDs and keeps a compressed copy of native
dylibs with absolute IDs. Its `post_install_steps` restores the signed bytes after
Homebrew linkage processing. Keep this step idempotent; CI verifies every installed
native runtime image against Developer ID signatures and notarization records.
