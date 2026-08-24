import { readFile, writeFile } from 'node:fs/promises'
import { auditMarkdown, auditRelease, parsePackageSpec, registryMetadata, releaseMetadata } from './registry-lib.mjs'
import { sourceEntryPaths } from './catalog-lib.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const spec = args.find(value => !value.startsWith('--'))
if (spec === undefined) throw new Error('usage: npm run promote -- <package[@version]> [--write]')
const { packageName, version } = parsePackageSpec(spec)
let targetPath
let entry
for (const path of await sourceEntryPaths()) {
  const candidate = JSON.parse(await readFile(path, 'utf8'))
  if (candidate.packageName === packageName) { targetPath = path; entry = candidate; break }
}
if (entry === undefined) throw new Error('new listings require a manually reviewed source entry before promote can update it')
const release = releaseMetadata(await registryMetadata(packageName), version)
const report = auditRelease(entry, release)
process.stdout.write(auditMarkdown(report))
if (!write) process.exit(0)
if (report.issues.some(issue => issue.severity === 'error')) throw new Error('audit contains blocking errors')
entry.release = {
  ...entry.release,
  version: release.version,
  exactSpec: `${packageName}@${release.version}`,
  distIntegrity: release.integrity,
  sourceRevision: release.sourceRevision,
  publishedAt: new Date(release.publishedAt).toISOString(),
  releaseNotes: `Marketplace update to ${packageName} ${release.version}; review upstream release notes before merging.`,
}
await writeFile(targetPath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8')
process.stdout.write(`updated ${targetPath}\n`)
