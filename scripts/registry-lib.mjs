import { createHash } from 'node:crypto'

const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u

export function parsePackageSpec(input) {
  const value = input.trim()
  const separator = value.startsWith('@') ? value.indexOf('@', 1) : value.lastIndexOf('@')
  const packageName = separator > 0 ? value.slice(0, separator) : value
  const version = separator > 0 ? value.slice(separator + 1) : undefined
  if (!packagePattern.test(packageName)) throw new Error(`invalid npm package ${JSON.stringify(packageName)}`)
  if (version !== undefined && !exactVersionPattern.test(version)) {
    throw new Error('version must be exact semver; dist-tags and ranges are not accepted')
  }
  return { packageName, version }
}

export async function registryMetadata(packageName, fetchImpl = globalThis.fetch) {
  const url = `https://registry.npmjs.org/${packageName.replace('/', '%2f')}`
  const response = await fetchImpl(url, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`)
  const text = await response.text()
  if (Buffer.byteLength(text) > 5 * 1024 * 1024) throw new Error('npm metadata response is too large')
  return JSON.parse(text)
}

export function releaseMetadata(metadata, requestedVersion) {
  const version = requestedVersion ?? metadata['dist-tags']?.latest
  if (typeof version !== 'string' || !exactVersionPattern.test(version)) {
    throw new Error('npm metadata has no valid exact release version')
  }
  const manifest = metadata.versions?.[version]
  if (manifest === undefined) throw new Error(`npm release ${version} does not exist`)
  const integrity = manifest.dist?.integrity
  if (typeof integrity !== 'string' || !/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u.test(integrity)) {
    throw new Error('npm release has no supported dist.integrity')
  }
  return {
    version,
    manifest,
    integrity,
    publishedAt: metadata.time?.[version],
    sourceRevision: manifest.gitHead,
  }
}

export function compareVersions(left, right) {
  const parse = (value) => {
    const withoutBuild = value.split('+', 1)[0]
    const [core, prerelease] = withoutBuild.split('-', 2)
    return { core: core.split('.').map(Number), prerelease: prerelease?.split('.') }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index]
  }
  if (a.prerelease === undefined || b.prerelease === undefined) {
    return a.prerelease === b.prerelease ? 0 : a.prerelease === undefined ? 1 : -1
  }
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const x = a.prerelease[index]; const y = b.prerelease[index]
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1
    if (x === y) continue
    const numericX = /^\d+$/u.test(x); const numericY = /^\d+$/u.test(y)
    if (numericX && numericY) return Number(x) - Number(y)
    if (numericX !== numericY) return numericX ? -1 : 1
    return x.localeCompare(y)
  }
  return 0
}

export function rangeAllowsVersion(range, version) {
  if (range === '0.0.0') return version === '0.0.0'
  return range.split('||').some((clause) => {
    const trimmed = clause.trim()
    if (trimmed.startsWith('^')) {
      const base = trimmed.slice(1)
      if (!exactVersionPattern.test(base) || compareVersions(version, base) < 0) return false
      const [major, minor] = base.split('.').map(Number)
      const upper = major > 0 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
      return compareVersions(version, upper) < 0
    }
    const comparators = trimmed.split(/\s+/u)
    if (comparators.every(value => /^(?:>=|>|<=|<)\d/u.test(value))) {
      return comparators.every((comparator) => {
        const operator = comparator.match(/^(>=|>|<=|<)/u)[0]
        const result = compareVersions(version, comparator.slice(operator.length))
        return operator === '>=' ? result >= 0 : operator === '>' ? result > 0 : operator === '<=' ? result <= 0 : result < 0
      })
    }
    return trimmed === version
  })
}

export function auditRelease(entry, release) {
  const manifest = release.manifest
  const peerDependencies = manifest.peerDependencies ?? {}
  const dshPeers = Object.entries(peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh'))
  const scripts = manifest.scripts ?? {}
  const lifecycleScripts = Object.keys(scripts).filter(name => ['preinstall', 'install', 'postinstall', 'prepublish', 'prepare'].includes(name))
  const dependencyNames = Object.keys(manifest.dependencies ?? {})
  const nativeSignals = dependencyNames.filter(name => /(?:node-pty|koffi|sharp|sqlite|canvas|ffi|native)/iu.test(name))
  const issues = []
  if (dshPeers.length === 0) issues.push({ severity: 'warning', code: 'missing-dsh-peer', message: 'manifest declares no @deepseek-ai/dsh* peer dependency' })
  if (typeof release.sourceRevision !== 'string') issues.push({ severity: 'error', code: 'missing-revision', message: 'npm release has no gitHead/source revision' })
  if (typeof release.publishedAt !== 'string') issues.push({ severity: 'error', code: 'missing-time', message: 'npm registry has no publication timestamp' })
  if (lifecycleScripts.length > 0) issues.push({ severity: 'review', code: 'lifecycle-scripts', message: `lifecycle scripts: ${lifecycleScripts.join(', ')}` })
  if (nativeSignals.length > 0) issues.push({ severity: 'review', code: 'native-signals', message: `possible native dependencies: ${nativeSignals.join(', ')}` })
  return { packageName: entry.packageName, fromVersion: entry.release.version, toVersion: release.version, dshPeers, lifecycleScripts, nativeSignals, issues }
}

export function auditMarkdown(report) {
  const lines = [`## Audit: ${report.packageName} ${report.fromVersion} → ${report.toVersion}`, '']
  lines.push(`- dist integrity: verified from npm registry metadata`)
  lines.push(`- DSH peers: ${report.dshPeers.length === 0 ? 'none declared' : report.dshPeers.map(([name, range]) => `${name} ${range}`).join(', ')}`)
  lines.push(`- lifecycle scripts: ${report.lifecycleScripts.join(', ') || 'none'}`)
  lines.push(`- native dependency signals: ${report.nativeSignals.join(', ') || 'none'}`)
  if (report.issues.length > 0) {
    lines.push('', '### Review findings', '')
    for (const issue of report.issues) lines.push(`- **${issue.severity.toUpperCase()} ${issue.code}**: ${issue.message}`)
  }
  return `${lines.join('\n')}\n`
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
