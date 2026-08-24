import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadSourceCatalog, outputPath, root } from './catalog-lib.mjs'
import { sha256 } from './registry-lib.mjs'

const catalog = await loadSourceCatalog()
const dist = resolve(root, 'site/dist')
const base = '/DeepRunnerPlugins/'
const escape = value => String(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const githubIcon = '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .7a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .7Z"/></svg>'
const searchIcon = '<svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>'
const platformIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
const updateIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>'
const iconFor = entry => `<div class="plugin-icon" aria-hidden="true">${escape(entry.displayName.trim()[0] ?? 'P')}</div>`
const formatDate = value => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
const platformName = value => ({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' })[value] ?? value
const capabilityName = value => ({ 'network-access': 'Network access', 'credential-storage': 'Credential storage', filesystem: 'File access', shell: 'Command execution' })[value] ?? value
const pluginCount = count => `${count} ${count === 1 ? 'plugin' : 'plugins'}`

const layout = (title, description, body, depth = 0) => {
  const prefix = '../'.repeat(depth)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#ffffff">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="${prefix}styles.css">
</head>
<body>
  <div class="topbar-wrap">
    <header class="shell topbar">
      <a class="brand" href="${base}"><span class="brand-mark" aria-hidden="true"></span><span>DeepRunner Plugins</span></a>
      <nav aria-label="Main navigation"><a href="${base}">Marketplace</a><a href="https://github.com/zhigui/DeepRunnerPlugins#publish-a-plugin">Publish</a></nav>
      <div class="topbar-actions"><a class="github-link" href="https://github.com/zhigui/DeepRunnerPlugins" rel="noreferrer">${githubIcon}<span>GitHub</span></a></div>
    </header>
  </div>
  <main>${body}</main>
  <footer class="shell footer"><span>DeepRunner Plugin Marketplace</span><span>Catalog ${escape(catalog.catalogVersion)} · <a href="${base}catalog/v1/catalog.json">Catalog API</a></span></footer>
  <script src="${prefix}market.js" defer></script>
</body>
</html>\n`
}

const listed = catalog.entries.filter(entry => entry.status !== 'deprecated')
const cards = listed.map(entry => {
  const detailUrl = `${base}plugin/${encodeURIComponent(entry.id)}/`
  const deepLink = `deeprunner://market/plugin/${encodeURIComponent(entry.id)}`
  const searchText = `${entry.displayName} ${entry.publisher} ${entry.summary} ${entry.description} ${entry.tags.join(' ')}`.toLocaleLowerCase()
  return `<article class="card" data-plugin-card data-search="${escape(searchText)}">
    <a class="card-link" href="${detailUrl}" aria-label="View ${escape(entry.displayName)} details"></a>
    ${iconFor(entry)}
    <div class="card-content">
      <div class="card-title-row"><h3>${escape(entry.displayName)}</h3><span class="version">v${escape(entry.release.version)}</span></div>
      <div class="publisher">${escape(entry.publisher)}</div>
      <p class="summary">${escape(entry.summary)}</p>
      <div class="meta-row"><span class="meta-item">${platformIcon}${escape(entry.release.platforms.map(platformName).join(' · '))}</span><span class="meta-item">${updateIcon}${escape(formatDate(entry.release.publishedAt))}</span></div>
    </div>
    <a class="install-button${entry.status === 'paused' ? ' paused' : ''}" href="${entry.status === 'paused' ? detailUrl : deepLink}">${entry.status === 'paused' ? 'Unavailable' : 'Install'}</a>
  </article>`
}).join('')

const home = `<section class="shell market-intro">
  <h1>Plugin Marketplace</h1>
  <p>Find and install plugins that add new connections and capabilities to DeepRunner.</p>
  <div class="search-row">
    <div class="search-box">${searchIcon}<input data-search type="search" placeholder="Search plugins, publishers, or features" aria-label="Search plugins" autocomplete="off"><kbd class="search-shortcut" data-search-shortcut>⌘ K</kbd><button class="search-clear" data-search-clear type="button" aria-label="Clear search" hidden>×</button></div>
  </div>
</section>
<section class="shell">
  <div class="market-heading"><h2>All plugins</h2><span class="result-count" data-result-count>${pluginCount(listed.length)}</span></div>
  <div class="grid" data-market-list>${cards}</div>
  <div class="empty" data-empty hidden><div class="empty-mark">⌕</div><h3>No plugins found</h3><p>Try a shorter plugin name, publisher, or feature.</p></div>
</section>`

await rm(dist, { recursive: true, force: true })
await mkdir(resolve(dist, 'catalog/v1'), { recursive: true })
await cp(resolve(root, 'site/styles.css'), resolve(dist, 'styles.css'))
await cp(resolve(root, 'site/market.js'), resolve(dist, 'market.js'))
await cp(outputPath, resolve(dist, 'catalog/v1/catalog.json'))
await writeFile(resolve(dist, 'index.html'), layout('DeepRunner Plugin Marketplace', 'Find, explore, and install DeepRunner plugins', home), 'utf8')

for (const entry of listed) {
  const dir = resolve(dist, 'plugin', entry.id)
  await mkdir(dir, { recursive: true })
  const deepLink = `deeprunner://market/plugin/${encodeURIComponent(entry.id)}`
  const body = `<article class="shell detail">
    <div class="breadcrumbs"><a href="${base}">Marketplace</a><span>/</span><span>${escape(entry.displayName)}</span></div>
    <header class="detail-header">${iconFor(entry)}<div><h1>${escape(entry.displayName)}</h1><p>${escape(entry.publisher)} · v${escape(entry.release.version)}</p></div><div class="detail-actions"><a class="install-button${entry.status === 'paused' ? ' paused' : ''}" href="${entry.status === 'paused' ? '#' : deepLink}">${entry.status === 'paused' ? 'Unavailable' : 'Install Plugin'}</a>${entry.repository ? `<a class="source-button" href="${escape(entry.repository)}" rel="noreferrer">View Source</a>` : ''}</div></header>
    <div class="detail-layout">
      <section class="panel"><h2>About this plugin</h2><p class="description">${escape(entry.description)}</p><h2>Tags</h2><div class="tags">${entry.tags.map(item => `<span class="tag">${escape(item)}</span>`).join('')}</div>${entry.release.releaseNotes ? `<h2>Release notes</h2><p class="description">${escape(entry.release.releaseNotes)}</p>` : ''}</section>
      <aside class="panel"><dl class="facts"><div><dt>Publisher</dt><dd>${escape(entry.publisher)}</dd></div><div><dt>Version</dt><dd>${escape(entry.release.version)}</dd></div><div><dt>Last updated</dt><dd>${escape(formatDate(entry.release.publishedAt))}</dd></div><div><dt>License</dt><dd>${escape(entry.license)}</dd></div><div><dt>Platforms</dt><dd>${escape(entry.release.platforms.map(platformName).join(' · '))}</dd></div><div><dt>DeepRunner</dt><dd>${escape(entry.release.deepRunnerVersionRange)}</dd></div><div><dt>Capabilities</dt><dd><span class="tags">${entry.release.capabilities.map(item => `<span class="tag capability">${escape(capabilityName(item))}</span>`).join('') || 'No additional capabilities'}</span></dd></div></dl></aside>
    </div>
  </article>`
  await writeFile(resolve(dir, 'index.html'), layout(`${entry.displayName} · DeepRunner Plugin Marketplace`, entry.summary, body, 2), 'utf8')
}

await writeFile(resolve(dist, 'catalog/v1/catalog.sha256'), `${sha256(await readFile(outputPath))}  catalog.json\n`, 'utf8')
await writeFile(resolve(dist, '.nojekyll'), '', 'utf8')
console.log(`built market site with ${listed.length} plugin page(s) at ${dist}`)
