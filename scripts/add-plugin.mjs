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
  const value = optionalList(name)
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
if (typeof release.publishedAt !== 'string' || Number.isNaN(Date.parse(release.publishedAt))) {
  throw new Error('npm release has no valid publication timestamp')
}
const manifest = release.manifest
const description = process.env.ADD_DESCRIPTION?.trim() || manifest.description?.trim()
  || `Review the upstream package metadata for ${packageName} before listing this plugin.`
const displayName = process.env.ADD_DISPLAY_NAME?.trim() || packageName.split('/').at(-1)
const summary = process.env.ADD_SUMMARY?.trim() || manifest.description?.trim()
  || `Draft marketplace listing for ${packageName}.`
const author = typeof manifest.author === 'string' ? manifest.author : manifest.author?.name
const publisher = process.env.ADD_PUBLISHER?.trim()
  || (packageName.startsWith('@') ? packageName.slice(1).split('/')[0] : undefined)
  || author
  || 'Unverified publisher'
const license = process.env.ADD_LICENSE?.trim() || (typeof manifest.license === 'string' ? manifest.license.trim() : '')
  || 'UNVERIFIED'
const capabilities = optionalList('ADD_CAPABILITIES')
const buildScriptPackages = optionalList('ADD_BUILD_SCRIPT_PACKAGES')
const repository = httpsUrl(process.env.ADD_REPOSITORY?.trim() || manifest.repository)
const homepage = httpsUrl(process.env.ADD_HOMEPAGE?.trim() || manifest.homepage)
const keywords = optionalList('ADD_TAGS')
const manifestKeywords = Array.isArray(manifest.keywords) ? manifest.keywords : typeof manifest.keywords === 'string' ? manifest.keywords.split(',') : []
const tags = [...new Set((keywords.length > 0 ? keywords : manifestKeywords).map(item => String(item).trim()).filter(Boolean))].slice(0, 64)
const dshPeerRanges = [...new Set(Object.entries(manifest.peerDependencies ?? {})
  .filter(([name, range]) => name.startsWith('@deepseek-ai/dsh') && typeof range === 'string')
  .map(([, range]) => range))]
const dshVersionRange = process.env.ADD_DSH_VERSION_RANGE?.trim()
  || (dshPeerRanges.length === 1 ? dshPeerRanges[0] : '0.0.0')
const sourceRevision = typeof release.sourceRevision === 'string' && release.sourceRevision.length > 0
  ? release.sourceRevision
  : `unverified-npm-artifact:${release.integrity}`

const entry = {
  id: packageName,
  packageName,
  displayName,
  summary,
  description,
  publisher,
  trustLevel: 'community',
  ...(repository === undefined ? {} : { repository }),
  ...(homepage === undefined ? {} : { homepage }),
  license,
  tags,
  status: 'paused',
  release: {
    version: release.version,
    exactSpec: `${packageName}@${release.version}`,
    distIntegrity: release.integrity,
    sourceRevision,
    publishedAt: new Date(release.publishedAt).toISOString(),
    dshVersionRange,
    deepRunnerVersionRange: process.env.ADD_DEEP_RUNNER_VERSION_RANGE?.trim() || '0.0.0',
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
  'The generated entry is intentionally paused and may be incompatible until the fields below are reviewed.',
  '',
  `- Source file: \`${target.slice(root.length + 1)}\``,
  `- DSH range: \`${entry.release.dshVersionRange}\``,
  `- DeepRunner range: \`${entry.release.deepRunnerVersionRange}\``,
  `- Platforms: ${entry.release.platforms.join(', ') || 'none selected'}`,
  `- Faces: ${entry.release.faces.join(', ') || 'none selected'}`,
  `- Capabilities: ${entry.release.capabilities.join(', ') || 'none declared'}`,
  '',
  '- [ ] Publisher and trust level are correct',
  '- [ ] Description, tags and license are accurate',
  '- [ ] sourceRevision is an audited upstream revision (replace an unverified-npm-artifact value)',
  '- [ ] DSH and DeepRunner compatibility ranges were tested',
  '- [ ] Platforms, faces and capabilities are complete',
  '- [ ] Lifecycle/native dependencies and buildScriptPackages were reviewed',
  '- [ ] status was changed from paused to listed only after every review item passed',
  '',
  auditMarkdown(audit),
].join('\n')
await writeFile(resolve(root, 'add-plugin-report.md'), checklist, 'utf8')
console.log(`created draft source entry ${target}`)
