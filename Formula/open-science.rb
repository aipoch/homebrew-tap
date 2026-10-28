# frozen_string_literal: true

# Installs the released standalone runtime without a desktop or host Node dependency.
class OpenScience < Formula
  desc "Standalone AI research CLI and local Web UI"
  homepage "https://aipoch.com/open-science"
  release_version = "1.0.5"
  license "Apache-2.0"

  livecheck do
    url :url
    strategy :github_latest
  end

  on_macos do
    on_arm do
      url "https://github.com/aipoch/open-science/releases/download/v#{release_version}/open-science-cli-#{release_version}-darwin-arm64.tar.gz"
      sha256 "c5dae1cafec3a95e4ab1927fd241005f111a2b21bd05c356d3b05942a8752889"
    end
    on_intel do
      url "https://github.com/aipoch/open-science/releases/download/v#{release_version}/open-science-cli-#{release_version}-darwin-x64.tar.gz"
      sha256 "b22c771a9d799a0d6d83c659ac52f418f2da3e6c9cdc77c03f1ddb74f9ae5355"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/aipoch/open-science/releases/download/v#{release_version}/open-science-cli-#{release_version}-linux-arm64-gnu.tar.gz"
      sha256 "b568b44efc14af8c3521e4b435a6d02aebb5d1b782dec4394d849603a07bb613"
    end
    on_intel do
      url "https://github.com/aipoch/open-science/releases/download/v#{release_version}/open-science-cli-#{release_version}-linux-x64-gnu.tar.gz"
      sha256 "172ad5ccc28f01209ae0abcf68b99a875b51869f4cd3c63143ce12636820c58d"
    end
  end

  # The archive already contains the pinned Node and signed native dependencies.
  preserve_rpath

  skip_clean "libexec"

  def install
    libexec.install Dir["*"]
    if OS.mac?
      # Brew rewrites absolute dylib IDs even with preserve_rpath. Retain the
      # signed originals so post_install can restore them after linkage fixing.
      originals = Dir["#{libexec}/**/*.{node,dylib}"].reject { |file| File.symlink?(file) }.select do |file|
        Utils.safe_popen_read("otool", "-D", file).lines.drop(1).any? { |line| line.strip.start_with?("/") }
      end
      unless originals.empty?
        system "tar", "-czf", libexec/"signed-dylibs.tar.gz", "-C", libexec,
               *originals.map { |file| Pathname(file).relative_path_from(libexec).to_s }
      end
    end
    bin.install_symlink libexec/"open-science"
  end

  post_install_steps do
    on_macos do
      if_path_exists "signed-dylibs.tar.gz", base: :libexec do
        run "/usr/bin/tar", args: ["-xzf", "{{libexec}}/signed-dylibs.tar.gz", "-C", "{{libexec}}"],
                            writable_paths: ["."], writable_base: :libexec
      end
    end
  end

  def caveats
    <<~EOS
      Start explicitly with: open-science start --no-open
      Stop the selected profile before upgrading: open-science stop
      Upgrade with: brew upgrade --formula aipoch/tap/open-science
      Research data and credentials retain their existing locations and survive uninstall.
      Use --config-root /absolute/path for an independent profile.
      If a desktop/npm launcher is earlier in PATH, use #{opt_bin}/open-science.
      Linux OS credentials need a user D-Bus session and unlocked Secret Service/KWallet.
      Linux headless also supports: open-science start --no-open --credential-store=file
      Python/R and Notebook sandbox prerequisites are separate; see the runtime guide:
      https://github.com/aipoch/open-science/blob/v#{version}/docs/standalone-runtime.md
    EOS
  end

  test do
    require "json"
    metadata = JSON.parse((libexec/"release.json").read)
    assert_equal version.to_s, metadata.fetch("version")
    assert_equal "v#{metadata.fetch("nodeVersion")}", shell_output("#{libexec}/node-runtime/node --version").strip
    assert_match "Usage: open-science", shell_output("#{bin}/open-science --help")
    profile = testpath/"profile with spaces"
    result = JSON.parse(shell_output("#{bin}/open-science init --config-root '#{profile}' --json"))
    assert_equal profile.to_s, result.fetch("configRoot")
    assert_equal({ "running" => false },
                 JSON.parse(shell_output("#{bin}/open-science status --config-root '#{profile}' --json", 1)))
  end
end
