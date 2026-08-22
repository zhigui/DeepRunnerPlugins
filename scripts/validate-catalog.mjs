import { readFile } from 'node:fs/promises'
import { loadSourceCatalog, outputPath, serializeCatalog, validateCatalog } from './catalog-lib.mjs'

const expected = serializeCatalog(await loadSourceCatalog())
const actual = await readFile(outputPath, 'utf8')
validateCatalog(JSON.parse(actual))
if (actual !== expected) {
  throw new Error('public catalog is stale; run npm run build and commit the result')
}
console.log('catalog is valid and generated output is up to date')

