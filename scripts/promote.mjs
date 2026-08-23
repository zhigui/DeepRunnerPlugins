import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { auditMarkdown, auditRelease, parsePackageSpec, registryMetadata, releaseMetadata } from './registry-lib.mjs'
import { root } from './catalog-lib.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const spec = args.find(value => !value.startsWith('--'))
if (spec === undefined) throw new Error('usage: npm run promote -- <package[@version]> [--write]')
const { packageName, version } = parsePackageSpec(spec)
const files = (await import('node:fs/promises')).readdir(resolve(root, 'plugins'))
let targetPath
let entry
for (const filename of await files) {
  if (!filename.endsWith('.json')) continue
  const path = resolve(root, 'plugins', filename)
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
  releaseNotes: `Curated update to ${packageName} ${release.version}; review upstream release notes before merging.`,
}
await writeFile(targetPath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8')
process.stdout.write(`updated ${targetPath}\n`)
