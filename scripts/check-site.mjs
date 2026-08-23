import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadSourceCatalog, root } from './catalog-lib.mjs'

const catalog = await loadSourceCatalog()
const dist = resolve(root, 'site/dist')
await access(resolve(dist, 'index.html'))
await access(resolve(dist, 'trust/index.html'))
const published = await readFile(resolve(dist, 'catalog/v1/catalog.json'), 'utf8')
const source = await readFile(resolve(root, 'public/catalog/v1/catalog.json'), 'utf8')
if (published !== source) throw new Error('site catalog differs from the canonical generated catalog')
for (const entry of catalog.entries.filter(entry => entry.status !== 'deprecated')) {
  const path = resolve(dist, 'plugin', entry.id, 'index.html')
  if ((await stat(path)).size === 0) throw new Error(`empty plugin page for ${entry.id}`)
  const html = await readFile(path, 'utf8')
  if (!html.includes(`deeprunner://market/plugin/${encodeURIComponent(entry.id)}`)) throw new Error(`plugin page ${entry.id} has no safe deep link`)
}
console.log('site output is complete and uses the canonical catalog')
