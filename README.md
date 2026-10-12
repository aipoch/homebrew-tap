# AIPOCH Homebrew Tap

The official [Homebrew](https://brew.sh) tap for AIPOCH command-line tools.

## Available formulae

| Formula                                                  | Description                                  |
| -------------------------------------------------------- | -------------------------------------------- |
| [`open-science`](https://github.com/aipoch/open-science) | Standalone Open Science CLI and local Web UI |

Open Science supports macOS (Apple Silicon and Intel) and glibc Linux (ARM64 and x64).
The runtime includes Node.js; no separate Node.js installation is required.

## Install

```sh
brew install aipoch/tap/open-science
```

Homebrew adds the tap automatically. To add it separately:

```sh
brew tap aipoch/tap
```

Start Open Science:

```sh
open-science start --no-open
open-science url
```

See the [Open Science runtime guide](https://github.com/aipoch/open-science/blob/main/docs/standalone-runtime.md)
for configuration, credentials and system requirements. The desktop app is available
through its separate [Homebrew Cask](https://formulae.brew.sh/cask/open-science).

## Upgrade

For a custom profile, pass the same `--config-root` to start and stop.
Stop the running instance before upgrading:

```sh
open-science stop
brew update
brew upgrade --formula aipoch/tap/open-science
```

## Uninstall

```sh
open-science stop
brew uninstall --formula aipoch/tap/open-science
```

Research data and credentials are retained. Existing profiles continue to use their
current locations, including the default `~/.open-science` directory.

## Existing desktop or npm installations

If another installation already provides `open-science`, invoke this Formula directly:

```sh
"$(brew --prefix aipoch/tap/open-science)/bin/open-science" start --no-open
```

For a command link conflict, install with `brew install --skip-link aipoch/tap/open-science`.
Use that same command for upgrades to keep the installation unlinked.

## Support and contributing

- [Open Science documentation](https://github.com/aipoch/open-science#readme)
- [Report a tap or installation issue](https://github.com/aipoch/homebrew-tap/issues)
- [Report an Open Science issue](https://github.com/aipoch/open-science/issues)
- [Contributing to this tap](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)
