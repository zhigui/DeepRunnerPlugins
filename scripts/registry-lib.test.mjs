import assert from 'node:assert/strict'
import test from 'node:test'
import { compareVersions, parsePackageSpec, rangeAllowsVersion, registryMetadata, releaseMetadata } from './registry-lib.mjs'

test('exact package spec parser rejects dist tags and ranges', () => {
  assert.deepEqual(parsePackageSpec('@scope/plugin@1.2.3'), { packageName: '@scope/plugin', version: '1.2.3' })
  assert.deepEqual(parsePackageSpec('plugin'), { packageName: 'plugin', version: undefined })
  assert.throws(() => parsePackageSpec('@scope/plugin@latest'), /exact semver/u)
  assert.throws(() => parsePackageSpec('plugin@^1.0.0'), /exact semver/u)
})

test('baseline range checker handles supported bounded forms', () => {
  assert.equal(rangeAllowsVersion('^0.1.0-rc.6', '0.1.0'), true)
  assert.equal(rangeAllowsVersion('^0.1.0-rc.6', '0.1.0-rc.7'), true)
  assert.equal(rangeAllowsVersion('^0.1.0-rc.6', '0.1.0-rc.5'), false)
  assert.equal(rangeAllowsVersion('^0.1.0-rc.6', '0.2.0'), false)
  assert.equal(rangeAllowsVersion('>=0.1.0 <0.2.0', '0.1.9'), true)
  assert.equal(compareVersions('1.2.4', '1.2.3') > 0, true)
})

test('registry metadata requests the full packument needed for publication timestamps', async () => {
  let request
  const metadata = await registryMetadata('@scope/plugin', async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      text: async () => JSON.stringify({
        'dist-tags': { latest: '1.2.3' },
        time: { '1.2.3': '2026-08-24T00:00:00.000Z' },
        versions: {
          '1.2.3': {
            gitHead: 'revision',
            dist: { integrity: `sha512-${Buffer.from('fixture').toString('base64')}` },
          },
        },
      }),
    }
  })

  assert.equal(request.url, 'https://registry.npmjs.org/@scope%2fplugin')
  assert.equal(request.options.headers.accept, 'application/json')
  assert.equal(releaseMetadata(metadata, '1.2.3').publishedAt, '2026-08-24T00:00:00.000Z')
})
