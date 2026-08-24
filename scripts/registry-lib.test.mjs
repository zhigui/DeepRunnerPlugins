import assert from 'node:assert/strict'
import test from 'node:test'
import { compareVersions, parsePackageSpec, rangeAllowsVersion } from './registry-lib.mjs'

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
