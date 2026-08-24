import { appendFile } from 'node:fs/promises'
import { parsePackageSpec } from './registry-lib.mjs'

const spec = process.env.PACKAGE_SPEC
const output = process.env.GITHUB_OUTPUT
if (spec === undefined || output === undefined) throw new Error('PACKAGE_SPEC and GITHUB_OUTPUT are required')
const { packageName, version } = parsePackageSpec(spec)
if (version === undefined) throw new Error('promotion workflow requires an exact package version')
const slug = packageName.replace(/^@/u, '').replaceAll('/', '-').replace(/[^a-z0-9._-]/gu, '-')
const kind = process.env.BRANCH_KIND === 'add' ? 'add' : 'promote'
await appendFile(output, `branch=${kind}-${slug}-${version}\n`, 'utf8')
