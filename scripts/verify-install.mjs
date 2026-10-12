import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function verifyInstall(prefix, profile, expectedVersion, expectedProject) {
  const payload = join(prefix, 'libexec')
  const metadata = JSON.parse(readFileSync(join(payload, 'release.json'), 'utf8'))
  assert.equal(metadata.version, expectedVersion)
  assert.equal(metadata.target, `${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}`)
  const node = spawnSync(join(payload, 'node-runtime/node'), ['--version'], { encoding: 'utf8' })
  assert.equal(node.status, 0, node.stderr)
  assert.equal(node.stdout.trim(), `v${metadata.nodeVersion}`)

  if (process.platform === 'darwin') {
    let count = 0
    function verifyNative(directory) {
      for (const file of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, file.name)
        if (file.isDirectory()) verifyNative(path)
        else if (file.isFile()) {
          const header = readFileSync(path).subarray(0, 16)
          const magic = header.subarray(0, 4).toString('hex')
          if (!['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(magic)) continue
          if (['feedface', 'feedfacf'].includes(magic) && header.readUInt32BE(12) === 1) continue
          if (['cefaedfe', 'cffaedfe'].includes(magic) && header.readUInt32LE(12) === 1) continue
          const verified = spawnSync('codesign', ['--verify', '--strict', '--check-notarization', path], { encoding: 'utf8', timeout: 30000 })
          assert.equal(verified.status, 0, `${path}: ${verified.stderr}`)
          const details = spawnSync('codesign', ['--display', '--verbose=4', path], { encoding: 'utf8' })
          assert.equal(details.status, 0, details.stderr)
          assert.match(details.stderr, /Authority=Developer ID Application:/)
          count++
        }
      }
    }
    verifyNative(payload)
    assert.ok(count > 0)
    console.log(`PASS ${count} native signatures and notarization records`)
  }

  mkdirSync(profile, { recursive: true })
  const poison = join(profile, 'host tools')
  mkdirSync(poison, { recursive: true })
  for (const name of ['node', 'npm', 'npx', 'electron']) {
    const path = join(poison, name)
    writeFileSync(path, '#!/bin/sh\nexit 91\n')
    chmodSync(path, 0o755)
  }
  const env = { ...process.env, OPEN_SCIENCE_CONFIG_ROOT: profile, OPEN_SCIENCE_WEB_PORT: '0', PATH: `${poison}:${process.env.PATH}` }
  const launcher = join(prefix, 'bin/open-science')
  function cli(args, status = 0) {
    const result = spawnSync(launcher, args, { env, encoding: 'utf8', timeout: 90000 })
    assert.equal(result.status, status, `${args.join(' ')}: ${result.error ?? result.stderr}`)
    return result.stdout
  }
  assert.match(cli(['--help']), /Usage: open-science/)
  assert.equal(JSON.parse(cli(['init', '--json'])).configRoot, profile)
  assert.deepEqual(JSON.parse(cli(['status', '--json'], 1)), { running: false })
  let project
  let failure
  try {
    cli(['start', '--no-open', ...(process.platform === 'linux' ? ['--credential-store=file'] : [])])
    const status = JSON.parse(cli(['status', '--json']))
    assert.equal(status.running, true)
    const url = new URL(cli(['url']).trim())
    assert.equal(url.hostname, '127.0.0.1')
    const state = JSON.parse(readFileSync(join(profile, 'web-service.json'), 'utf8'))
    const token = readFileSync(join(profile, 'web-token'), 'utf8').trim()
    const response = await fetch(`http://127.0.0.1:${state.port}/`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<html/i)
    if (expectedProject) {
      const projects = JSON.parse(cli(['project', 'list', '--json']))
      project = projects.find((item) => item.id === expectedProject.id)
      assert.ok(project, 'Upgrade lost the persisted project')
      assert.equal(project.name, expectedProject.name)
      assert.equal(project.description, expectedProject.description)
    } else {
      project = JSON.parse(cli(['project', 'create', 'Homebrew upgrade fixture', '--description', 'Preserve this research project across upgrades.', '--json']))
      assert.ok(project.id)
    }
    console.log(`PASS ${metadata.target} ${metadata.version}: bundled Node, linked CLI, authenticated Web and persisted project`)
  } catch (error) {
    failure = error
  } finally {
    try {
      cli(['stop'])
      assert.deepEqual(JSON.parse(cli(['status', '--json'], 1)), { running: false })
    } catch (cleanupError) {
      failure = failure ? new AggregateError([failure, cleanupError], 'Verification and shutdown failed') : cleanupError
    }
  }
  if (failure) throw failure
  return project
}
