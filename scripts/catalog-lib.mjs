import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const outputPath = resolve(root, 'public/catalog/v1/catalog.json')

const idPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u
const integrityPattern = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function string(value, label, max = 12_000) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0'), `${label} must be a non-empty bounded string`)
}

function strings(value, label, maxItems = 64) {
  assert(Array.isArray(value) && value.length <= maxItems, `${label} must be a bounded array`)
  value.forEach((item, index) => string(item, `${label}[${index}]`, 128))
}

function exactKeys(value, label, required, optional = []) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
  const allowed = new Set([...required, ...optional])
  required.forEach(key => assert(Object.hasOwn(value, key), `${label}.${key} is required`))
  Object.keys(value).forEach(key => assert(allowed.has(key), `${label}.${key} is not supported`))
}

function timestamp(value, label) {
  string(value, label, 64)
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) && !Number.isNaN(Date.parse(value)), `${label} must be an ISO UTC timestamp`)
}

function validateRelease(release, packageName, label) {
  const required = ['version', 'exactSpec', 'distIntegrity', 'sourceRevision', 'publishedAt', 'dshVersionRange', 'platforms', 'faces', 'capabilities']
  exactKeys(release, label, required, ['deepRunnerVersionRange', 'architectures', 'buildScriptPackages', 'releaseNotes'])
  string(release.version, `${label}.version`, 128)
  assert(semverPattern.test(release.version), `${label}.version must be exact semver`)
  assert(release.exactSpec === `${packageName}@${release.version}`, `${label}.exactSpec must pin packageName and version`)
  assert(integrityPattern.test(release.distIntegrity), `${label}.distIntegrity must be an SRI hash`)
  string(release.sourceRevision, `${label}.sourceRevision`, 256)
  timestamp(release.publishedAt, `${label}.publishedAt`)
  string(release.dshVersionRange, `${label}.dshVersionRange`, 128)
  if (release.deepRunnerVersionRange !== undefined) string(release.deepRunnerVersionRange, `${label}.deepRunnerVersionRange`, 128)
  strings(release.platforms, `${label}.platforms`, 3)
  assert(release.platforms.every(value => ['darwin', 'win32', 'linux'].includes(value)), `${label}.platforms has an unsupported platform`)
  if (release.architectures !== undefined) strings(release.architectures, `${label}.architectures`, 16)
  strings(release.faces, `${label}.faces`, 2)
  assert(release.faces.every(value => ['host', 'client'].includes(value)), `${label}.faces has an unsupported face`)
  strings(release.capabilities, `${label}.capabilities`)
  if (release.buildScriptPackages !== undefined) {
    strings(release.buildScriptPackages, `${label}.buildScriptPackages`, 32)
    assert(release.buildScriptPackages.every(packageName => packagePattern.test(packageName)), `${label}.buildScriptPackages has an invalid package name`)
    assert(new Set(release.buildScriptPackages).size === release.buildScriptPackages.length, `${label}.buildScriptPackages must be unique`)
  }
  if (release.releaseNotes !== undefined) string(release.releaseNotes, `${label}.releaseNotes`)
}

function validateEntry(entry, label) {
  const required = ['id', 'packageName', 'displayName', 'summary', 'description', 'publisher', 'trustLevel', 'license', 'tags', 'status', 'release']
  exactKeys(entry, label, required, ['repository', 'homepage'])
  string(entry.id, `${label}.id`, 128)
  string(entry.packageName, `${label}.packageName`, 214)
  assert(idPattern.test(entry.id), `${label}.id is invalid`)
  assert(packagePattern.test(entry.packageName), `${label}.packageName is invalid`)
  for (const key of ['displayName', 'summary', 'description', 'publisher', 'license']) string(entry[key], `${label}.${key}`)
  assert(['builtin', 'verified-publisher', 'community'].includes(entry.trustLevel), `${label}.trustLevel is invalid`)
  assert(['listed', 'paused', 'deprecated'].includes(entry.status), `${label}.status is invalid`)
  for (const key of ['repository', 'homepage']) {
    if (entry[key] !== undefined) {
      string(entry[key], `${label}.${key}`, 2_048)
      assert(new URL(entry[key]).protocol === 'https:', `${label}.${key} must use HTTPS`)
    }
  }
  strings(entry.tags, `${label}.tags`)
  validateRelease(entry.release, entry.packageName, `${label}.release`)
}

export function validateCatalog(catalog) {
  const required = ['schemaVersion', 'catalogVersion', 'generatedAt', 'sourceId', 'sourceRevision', 'entries']
  exactKeys(catalog, 'catalog', required, ['revocations'])
  assert(catalog.schemaVersion === 1, 'catalog.schemaVersion must be 1')
  string(catalog.catalogVersion, 'catalog.catalogVersion', 128)
  timestamp(catalog.generatedAt, 'catalog.generatedAt')
  string(catalog.sourceId, 'catalog.sourceId', 128)
  string(catalog.sourceRevision, 'catalog.sourceRevision', 256)
  assert(Array.isArray(catalog.entries) && catalog.entries.length <= 1_000, 'catalog.entries must be a bounded array')
  catalog.entries.forEach((entry, index) => validateEntry(entry, `catalog.entries[${index}]`))
  const ids = new Set(catalog.entries.map(entry => entry.id))
  const packages = new Set(catalog.entries.map(entry => entry.packageName))
  assert(ids.size === catalog.entries.length, 'catalog entry ids must be unique')
  assert(packages.size === catalog.entries.length, 'catalog package names must be unique')
  assert(Array.isArray(catalog.revocations ?? []), 'catalog.revocations must be an array')
  for (const [index, revocation] of (catalog.revocations ?? []).entries()) {
    const label = `catalog.revocations[${index}]`
    exactKeys(revocation, label, ['pluginId', 'reason', 'action', 'publishedAt'], ['version'])
    assert(ids.has(revocation.pluginId), `${label}.pluginId must reference a catalog entry`)
    string(revocation.reason, `${label}.reason`, 1_000)
    assert(['block-install', 'recommend-remove'].includes(revocation.action), `${label}.action is invalid`)
    timestamp(revocation.publishedAt, `${label}.publishedAt`)
    if (revocation.version !== undefined) assert(semverPattern.test(revocation.version), `${label}.version must be exact semver`)
  }
  return catalog
}

export async function loadSourceCatalog() {
  const config = JSON.parse(await readFile(resolve(root, 'catalog.config.json'), 'utf8'))
  const filenames = (await readdir(resolve(root, 'plugins'))).filter(name => name.endsWith('.json')).sort()
  const entries = await Promise.all(filenames.map(async name => JSON.parse(await readFile(resolve(root, 'plugins', name), 'utf8'))))
  return validateCatalog({ ...config, entries })
}

export function serializeCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`
}
