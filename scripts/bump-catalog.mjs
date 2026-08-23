import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { root } from './catalog-lib.mjs'

const path = resolve(root, 'catalog.config.json')
const config = JSON.parse(await readFile(path, 'utf8'))
const now = new Date()
const date = now.toISOString().slice(0, 10).replaceAll('-', '.')
const match = new RegExp(`^${date.replaceAll('.', '\\.')}\\.(\\d+)$`, 'u').exec(config.catalogVersion)
config.catalogVersion = `${date}.${match === null ? 1 : Number(match[1]) + 1}`
config.generatedAt = now.toISOString()
config.sourceRevision = `catalog-${config.catalogVersion}`
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
console.log(`bumped catalog to ${config.catalogVersion}`)
