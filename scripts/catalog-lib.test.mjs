import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { sourceEntryPath, sourceEntryPaths, validateCatalog } from './catalog-lib.mjs'

test('scoped npm identities map to nested source paths', () => {
  assert.match(sourceEntryPath('@scope/plugin'), /plugins[\\/]@scope[\\/]plugin\.json$/u)
  assert.match(sourceEntryPath('plugin'), /plugins[\\/]plugin\.json$/u)
})

test('source entry discovery is recursive and deterministic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deeprunner-catalog-'))
  await mkdir(join(directory, '@scope'), { recursive: true })
  await writeFile(join(directory, 'z.json'), '{}\n')
  await writeFile(join(directory, '@scope', 'a.json'), '{}\n')
  assert.deepEqual(await sourceEntryPaths(directory), [join(directory, '@scope', 'a.json'), join(directory, 'z.json')].sort())
})

test('catalog validation accepts scoped npm identities and rejects flattened ids', () => {
  const entry = {
    id: '@scope/plugin', packageName: '@scope/plugin', displayName: 'Plugin', summary: 'Summary',
    description: 'Description', publisher: 'Publisher', trustLevel: 'community', license: 'MIT', tags: [], status: 'listed',
    release: {
      version: '1.2.3', exactSpec: '@scope/plugin@1.2.3',
      distIntegrity: `sha512-${Buffer.from('fixture').toString('base64')}`, sourceRevision: 'revision',
      publishedAt: '2026-08-24T00:00:00.000Z', dshVersionRange: '^0.1.0', platforms: ['darwin'], faces: ['host'], capabilities: [],
    },
  }
  const catalog = { schemaVersion: 1, catalogVersion: 'test', generatedAt: '2026-08-24T00:00:00.000Z', sourceId: 'test', sourceRevision: 'test', entries: [entry] }
  assert.doesNotThrow(() => validateCatalog(catalog))
  assert.throws(() => validateCatalog({ ...catalog, entries: [{ ...entry, id: '@scope.plugin' }] }), /id is invalid/u)
})
