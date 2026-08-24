import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadSourceCatalog, root } from './catalog-lib.mjs'
import { validatePluginDeepLink } from './site-lib.mjs'

const catalog = await loadSourceCatalog()
const dist = resolve(root, 'site/dist')
await access(resolve(dist, 'index.html'))
const published = await readFile(resolve(dist, 'catalog/v1/catalog.json'), 'utf8')
const source = await readFile(resolve(root, 'public/catalog/v1/catalog.json'), 'utf8')
if (published !== source) throw new Error('site catalog differs from the canonical generated catalog')
const home = await readFile(resolve(dist, 'index.html'), 'utf8')
const assertEnglishUi = (html, page) => {
  if (/\p{Script=Han}/u.test(html)) throw new Error(`${page} contains non-English interface text`)
}
assertEnglishUi(home, 'market homepage')
if (!home.includes('data-search') || !home.includes('class="install-button')) throw new Error('market homepage must expose search and install actions')
if (home.includes('data-sort') || home.includes('sort-select')) throw new Error('market homepage must use catalog order without sort controls')
const styles = await readFile(resolve(dist, 'styles.css'), 'utf8')
if (!styles.includes('[hidden] { display: none !important; }')) throw new Error('hidden search results can be overridden by card display styles')
for (const entry of catalog.entries.filter(entry => entry.status !== 'deprecated')) {
  const path = resolve(dist, 'plugin', entry.id, 'index.html')
  if ((await stat(path)).size === 0) throw new Error(`empty plugin page for ${entry.id}`)
  const html = await readFile(path, 'utf8')
  assertEnglishUi(html, `plugin page ${entry.id}`)
  validatePluginDeepLink(html, entry)
  if (html.includes('data-copy-link') || html.includes('class="notice"') || html.includes('class="actions"')) throw new Error(`plugin page ${entry.id} contains removed detail actions`)
  if (entry.repository && (!html.includes('class="detail-actions"') || !html.includes('class="source-button"'))) throw new Error(`plugin page ${entry.id} must place source next to install`)
}
console.log('site output is complete and uses the canonical catalog')
