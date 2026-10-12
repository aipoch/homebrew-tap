import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyInstall } from './verify-install.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const formulaPath = join(root, 'Formula/open-science.rb')
const candidate = readFileSync(formulaPath, 'utf8')
const version = candidate.match(/^  release_version = "([0-9]+\.[0-9]+\.[0-9]+)"$/m)?.[1]
assert.ok(version, 'Missing stable candidate version')
const revision = Number(candidate.match(/^  revision (\d+)$/m)?.[1] ?? 0)
const upgraded = /^  revision \d+$/m.test(candidate)
  ? candidate.replace(/^  revision \d+$/m, `  revision ${revision + 1}`)
  : candidate.replace(/^  license ([^\n]+)$/m, `$&\n  revision ${revision + 1}`)
assert.notEqual(upgraded, candidate, 'Missing revision insertion point')
const env = { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_INSTALL_CLEANUP: '1', HOMEBREW_NO_ANALYTICS: '1' }
function brew(args, status = 0) {
  const result = spawnSync('brew', args, { env, encoding: 'utf8', timeout: 900000, maxBuffer: 8 * 1024 * 1024 })
  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  assert.equal(result.status, status, `${args.join(' ')}: ${result.error ?? 'Brew failed'}`)
  return result.stdout.trim()
}
assert.equal(realpathSync(brew(['--repository', 'aipoch/tap'])), realpathSync(root), 'Run this script from the registered tap checkout')
const installed = spawnSync('brew', ['list', '--formula', '--versions', 'open-science'], { env, encoding: 'utf8' })
assert.ok(installed.status === 0 || installed.status === 1, installed.stderr)
assert.equal(installed.stdout.trim(), '', 'Refusing to replace an existing installation')
const skipLink = process.env.OPEN_SCIENCE_BREW_TEST_SKIP_LINK === '1'
const temporary = mkdtempSync(join(tmpdir(), 'open-science brew upgrade '))
const profile = join(temporary, 'profile')
let installedByTest = false
let passed = false
try {
  // Exercise Brew's real upgrade path with the same published release.
  // The synthetic revision is test-only and is always restored before exit.
  // Mark before install so a partially installed test keg is still cleaned up.
  installedByTest = true
  brew(['install', '--formula', ...(skipLink ? ['--skip-link'] : []), 'aipoch/tap/open-science'])
  brew(['test', ...(skipLink ? ['--force'] : []), 'aipoch/tap/open-science'])
  if (!skipLink) assert.equal(realpathSync(join(brew(['--prefix']), 'bin/open-science')), realpathSync(join(brew(['--prefix', 'aipoch/tap/open-science']), 'bin/open-science')))
  const project = await verifyInstall(brew(['--prefix', 'aipoch/tap/open-science']), profile, version)
  writeFileSync(join(profile, 'uninstall-marker.txt'), 'retain research data\n')
  writeFileSync(formulaPath, upgraded)
  // Install upgrades an outdated Formula and supports --skip-link; upgrade relinks it.
  brew(skipLink ? ['install', '--formula', '--skip-link', 'aipoch/tap/open-science'] : ['upgrade', '--formula', 'aipoch/tap/open-science'])
  brew(['test', ...(skipLink ? ['--force'] : []), 'aipoch/tap/open-science'])
  if (!skipLink) assert.equal(realpathSync(join(brew(['--prefix']), 'bin/open-science')), realpathSync(join(brew(['--prefix', 'aipoch/tap/open-science']), 'bin/open-science')))
  const upgradedPrefix = brew(['--prefix', 'aipoch/tap/open-science'])
  assert.equal(basename(realpathSync(upgradedPrefix)), `${version}_${revision + 1}`)
  await verifyInstall(upgradedPrefix, profile, version, project)
  brew(['uninstall', '--force', '--formula', 'aipoch/tap/open-science'])
  installedByTest = false
  assert.equal(readFileSync(join(profile, 'uninstall-marker.txt'), 'utf8'), 'retain research data\n')
  passed = true
  console.log(`PASS Brew install ${version}, upgrade revision ${revision} to ${revision + 1}, project preservation and uninstall data retention`)
} finally {
  writeFileSync(formulaPath, candidate)
  if (installedByTest) {
    const prefix = brew(['--prefix', 'aipoch/tap/open-science'])
    const launcher = join(prefix, 'bin/open-science')
    const stop = spawnSync(launcher, ['stop', '--config-root', profile], { env, encoding: 'utf8', timeout: 90000 })
    assert.equal(stop.status, 0, `Shutdown failed; retaining test keg and profile at ${profile}: ${stop.stderr}`)
    const stopped = spawnSync(launcher, ['status', '--config-root', profile, '--json'], { env, encoding: 'utf8', timeout: 30000 })
    assert.equal(stopped.status, 1, `Runtime may be active; retaining test keg and profile at ${profile}`)
    assert.deepEqual(JSON.parse(stopped.stdout), { running: false })
    const result = spawnSync('brew', ['uninstall', '--force', '--formula', 'aipoch/tap/open-science'], { env, stdio: 'inherit' })
    assert.equal(result.status, 0, 'Test keg cleanup failed; inspect the isolated profile before removing it')
  }
  if (passed) rmSync(temporary, { recursive: true })
  else console.error(`Retained failed verification profile: ${profile}`)
}
