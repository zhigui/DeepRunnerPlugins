import { loadSourceCatalog } from './catalog-lib.mjs'
import { compareVersions, rangeAllowsVersion, registryMetadata, releaseMetadata } from './registry-lib.mjs'

const baselineIndex = process.argv.indexOf('--check-baseline')
const baseline = baselineIndex === -1 ? undefined : process.argv[baselineIndex + 1]
if (baselineIndex !== -1 && baseline === undefined) throw new Error('--check-baseline requires an exact version')
const catalog = await loadSourceCatalog()
let findings = 0
for (const entry of catalog.entries) {
  if (baseline !== undefined && !rangeAllowsVersion(entry.release.dshVersionRange, baseline)) {
    findings += 1
    console.log(`BASELINE ${entry.packageName}@${entry.release.version}: ${entry.release.dshVersionRange} does not allow ${baseline}`)
  }
  if (baseline === undefined && entry.status === 'listed') {
    const latest = releaseMetadata(await registryMetadata(entry.packageName)).version
    if (compareVersions(latest, entry.release.version) > 0) {
      findings += 1
      console.log(`UPDATE ${entry.packageName}: ${entry.release.version} -> ${latest}`)
    }
  }
}
if (findings === 0) console.log(baseline === undefined ? 'all listed plugins are current' : `all entries allow DSH ${baseline}`)
process.exitCode = findings === 0 ? 0 : 2
