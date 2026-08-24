import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePluginDeepLink } from './site-lib.mjs'

test('listed plugin pages must expose their canonical deep link', () => {
  const entry = { id: '@scope/plugin', status: 'listed' }
  assert.doesNotThrow(() => validatePluginDeepLink('href="deeprunner://market/plugin/@scope/plugin"', entry))
  assert.throws(() => validatePluginDeepLink('href="#"', entry), /has no safe deep link/u)
})

test('paused plugin pages must not expose an install deep link', () => {
  const entry = { id: '@scope/plugin', status: 'paused' }
  assert.doesNotThrow(() => validatePluginDeepLink('href="#"', entry))
  assert.throws(
    () => validatePluginDeepLink('href="deeprunner://market/plugin/@scope/plugin"', entry),
    /must not expose/u,
  )
})
