# AIPOCH Homebrew tap

Homebrew installation definitions for AIPOCH command-line tools. Each Formula has
its own version, platform downloads and checksums; additional tools can share this tap.

## Install the standalone Open Science CLI

```bash
brew install aipoch/tap/open-science
open-science start --no-open
open-science status --json
open-science url
open-science stop
```

The Formula installs the released standalone runtime, including its pinned Node,
backend and Web UI. It supports macOS Apple Silicon/Intel and glibc Linux ARM64/x64;
it needs no installed Node, npm or Electron. Linux musl and Windows are not supported
by this Formula. Python/R and Notebook sandbox requirements remain separate.

The desktop client remains available independently:

```bash
brew install --cask open-science
```

CLI and desktop retain their existing data and credential rules, including the
`~/.open-science` default. Use `--config-root /absolute/path` for an independent profile.
The runtime guide explains compatible shared-profile attachment and version matching.

If a desktop/npm launcher takes precedence in PATH, inspect `type -a open-science`
and invoke `"$(brew --prefix aipoch/tap/open-science)/bin/open-science"` explicitly.
Homebrew can skip the global link when the same-name desktop Cask is already installed;
use the explicit Formula path in that case too.
If another installer already owns `$(brew --prefix)/bin/open-science`, Homebrew
reports a link conflict. Either remove that installation using its own installer,
or install with `brew install --skip-link aipoch/tap/open-science` and use the explicit
Formula path above. Upgrade an unlinked installation with
`brew install --skip-link aipoch/tap/open-science`; `brew upgrade` tries to link it again.
Do not use `brew link --overwrite` on another installer's command.
Installation does not start a service.

Linux OS-backed credentials require system libsecret/DBus libraries, `busctl`, a user
D-Bus session and an unlocked Secret Service or KWallet. Linux headless can opt into
existing file-mode credentials with `open-science start --no-open --credential-store=file`.
Read the [standalone runtime guide](https://github.com/aipoch/open-science/blob/main/docs/standalone-runtime.md)
for credential, glibc, Python/R and sandbox requirements.

## Upgrade and uninstall

Stop the runtime that owns the selected profile before upgrading:

```bash
open-science stop
brew update
brew upgrade --formula aipoch/tap/open-science
open-science start --no-open
```

Use the same `--config-root` for stop/start when selecting a non-default profile.
macOS upgrades move signed helpers between versioned Cellar paths and may require
Keychain authorization again; do not bypass signature or credential protection.

```bash
brew uninstall --formula aipoch/tap/open-science
```

Uninstall removes the Homebrew payload and command link, retaining research data and
credentials. Stop the selected runtime before uninstalling. The Formula does not
manage desktop updates or delete desktop/application profiles.

## Maintain a release

1. Use a published stable [Open Science Release](https://github.com/aipoch/open-science/releases),
   with all four CLI archives and its `SHA256SUMS.txt`. Never use desktop installers or source archives.
2. Create a change branch from `main`. Change `release_version` and all four `sha256` values
   in `Formula/open-science.rb` together, using the checksum entry for each named target.
3. Download and independently verify the archives; compare against the published checksums
   and GitHub asset digests. Keep versioned URLs immutable and preserve upstream native signatures.
4. Run `brew style Formula/open-science.rb` and `brew audit --strict --online aipoch/tap/open-science`.
   In a disposable registered tap checkout without an installed Open Science Formula, run
   `node scripts/test-upgrade.mjs`. This is a maintainer test tool; users need no host Node.
   On a developer machine with an existing npm command link, use
   `OPEN_SCIENCE_BREW_TEST_SKIP_LINK=1 node scripts/test-upgrade.mjs` to preserve it;
   This local option upgrades using `brew install --skip-link`;
   CI checks normal linking and `brew upgrade` on clean runners.
5. Open a same-repository PR. Use Conventional Commit subjects with a scope, e.g.
   `chore(open-science): update runtime to 0.38.0`. Check all four native CI lanes before merging.
   Upgrade tests reuse the current release and apply a temporary Formula revision bump;
   the published Formula is restored afterward. They do not install historical releases.

CI tests real Brew installation, backend start/Web access/stop, project persistence
through a Formula revision upgrade and uninstall data retention on macOS/Linux ARM64/x64. The manual
workflow selects one runner for a focused dry-run and does not publish packages or releases.
Before that workflow exists on the default branch, maintainers can temporarily set the
repository variable `FORMULA_DRY_RUN_RUNNER` to one listed runner for PR debugging.
Delete that variable and rerun the workflow to validate all four runners before merging.

On macOS the Formula preserves upstream `@rpath` IDs and retains a compressed copy
of dylibs with absolute IDs. Its post-install step restores those signed bytes after
Brew's linkage processing; repeated post-install is safe. CI verifies every installed
native runtime image against Developer ID signatures and notarization records.

Changes go through reviewed Formula bumps; this tap has no automatic cross-repository
publication credentials. Open Science releases and this tap's Formula versions are
maintained separately from the official desktop Cask.
