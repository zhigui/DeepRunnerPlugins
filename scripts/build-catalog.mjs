import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { loadSourceCatalog, outputPath, serializeCatalog } from './catalog-lib.mjs'

const catalog = await loadSourceCatalog()
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, serializeCatalog(catalog), 'utf8')
console.log(`built ${catalog.entries.length} catalog entry at ${outputPath}`)

