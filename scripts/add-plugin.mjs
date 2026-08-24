import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { auditMarkdown, auditRelease, parsePackageSpec, registryMetadata, releaseMetadata } from './registry-lib.mjs'
import { root, sourceEntryPath, sourceEntryPaths } from './catalog-lib.mjs'

const required = name => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const list = (name, allowed) => {
  const value = required(name).split(',').map(item => item.trim()).filter(Boolean)
  if (new Set(value).size !== value.length) throw new Error(`${name} must not contain duplicates`)
  if (allowed !== undefined && value.some(item => !allowed.includes(item))) {
    throw new Error(`${name} contains an unsupported value`)
  }
  return value
}

const optionalList = name => (process.env[name]?.trim()
  ? process.env[name].split(',').map(item => item.trim()).filter(Boolean)
  : [])

const httpsUrl = value => {
  const raw = typeof value === 'string' ? value : value?.url
  if (typeof raw !== 'string') return undefined
  const normalized = raw.replace(/^git\+https:/u, 'https:').replace(/^git:\/\//u, 'https://')
  try { return new URL(normalized).protocol === 'https:' ? normalized : undefined } catch { return undefined }
}

const { packageName, version } = parsePackageSpec(required('ADD_PACKAGE'))
if (version === undefined) throw new Error('ADD_PACKAGE must pin an exact version')
for (const path of await sourceEntryPaths()) {
  const existing = JSON.parse(await readFile(path, 'utf8'))
  if (existing.id === packageName || existing.packageName === packageName) {
    throw new Error(`${packageName} is already listed; use Promote plugin release instead`)
  }
}

const metadata = await registryMetadata(packageName)
const release = releaseMetadata(metadata, version)
if (typeof release.sourceRevision !== 'string' || release.sourceRevision.length === 0) {
  throw new Error('npm release has no gitHead/source revision; the listing must pin a reviewed source revision')
}
if (typeof release.publishedAt !== 'string' || Number.isNaN(Date.parse(release.publishedAt))) {
  throw new Error('npm release has no valid publication timestamp')
}
const manifest = release.manifest
const description = process.env.ADD_DESCRIPTION?.trim() || manifest.description?.trim()
if (!description) throw new Error('ADD_DESCRIPTION is required when npm metadata has no description')
const license = process.env.ADD_LICENSE?.trim() || (typeof manifest.license === 'string' ? manifest.license.trim() : '')
if (!license) throw new Error('npm metadata has no string license; set ADD_LICENSE after reviewing the package license')
const capabilities = optionalList('ADD_CAPABILITIES')
const buildScriptPackages = optionalList('ADD_BUILD_SCRIPT_PACKAGES')
const repository = httpsUrl(process.env.ADD_REPOSITORY?.trim() || manifest.repository)
const homepage = httpsUrl(process.env.ADD_HOMEPAGE?.trim() || manifest.homepage)
const keywords = optionalList('ADD_TAGS')
const manifestKeywords = Array.isArray(manifest.keywords) ? manifest.keywords : typeof manifest.keywords === 'string' ? manifest.keywords.split(',') : []
const tags = [...new Set((keywords.length > 0 ? keywords : manifestKeywords).map(item => String(item).trim()).filter(Boolean))].slice(0, 64)

const entry = {
  id: packageName,
  packageName,
  displayName: required('ADD_DISPLAY_NAME'),
  summary: required('ADD_SUMMARY'),
  description,
  publisher: required('ADD_PUBLISHER'),
  trustLevel: 'community',
  ...(repository === undefined ? {} : { repository }),
  ...(homepage === undefined ? {} : { homepage }),
  license,
  tags,
  status: 'listed',
  release: {
    version: release.version,
    exactSpec: `${packageName}@${release.version}`,
    distIntegrity: release.integrity,
    sourceRevision: release.sourceRevision,
    publishedAt: new Date(release.publishedAt).toISOString(),
    dshVersionRange: required('ADD_DSH_VERSION_RANGE'),
    deepRunnerVersionRange: required('ADD_DEEP_RUNNER_VERSION_RANGE'),
    platforms: list('ADD_PLATFORMS', ['darwin', 'win32', 'linux']),
    faces: list('ADD_FACES', ['host', 'client']),
    capabilities,
    ...(buildScriptPackages.length === 0 ? {} : { buildScriptPackages }),
    releaseNotes: `Initial marketplace release pinning ${packageName} ${release.version}.`,
  },
}

const target = sourceEntryPath(packageName)
await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(entry, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })

const audit = auditRelease({ packageName, release: { version: '(new listing)' } }, release)
const checklist = [
  '# New plugin listing review',
  '',
  `Generated a draft listing for \`${packageName}@${version}\`.`,
  '',
  '- [ ] Publisher and trust level are correct',
  '- [ ] Description, tags and license are accurate',
  '- [ ] DSH and DeepRunner compatibility ranges were tested',
  '- [ ] Platforms, faces and capabilities are complete',
  '- [ ] Lifecycle/native dependencies and buildScriptPackages were reviewed',
  '',
  auditMarkdown(audit),
].join('\n')
await writeFile(resolve(root, 'add-plugin-report.md'), checklist, 'utf8')
console.log(`created draft source entry ${target}`)
