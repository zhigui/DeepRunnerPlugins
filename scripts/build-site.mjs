import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadSourceCatalog, outputPath, root } from './catalog-lib.mjs'
import { sha256 } from './registry-lib.mjs'

const catalog = await loadSourceCatalog()
const dist = resolve(root, 'site/dist')
const base = '/DeepRunnerPlugins/'
const escape = value => String(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const layout = (title, description, body, depth = 0) => {
  const prefix = '../'.repeat(depth)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#006827"><title>${escape(title)}</title><link rel="stylesheet" href="${prefix}styles.css"></head><body><header class="shell topbar"><a class="brand" href="${base}">DeepRunner Plugins</a><nav><a href="${base}">浏览插件</a><a href="${base}trust/">信任与审核</a><a href="https://github.com/zhigui/DeepRunnerPlugins">GitHub</a></nav></header><main>${body}</main><footer class="shell footer">目录 ${escape(catalog.catalogVersion)} · 生成于 ${escape(catalog.generatedAt)} · 安装始终由 DeepRunner 客户端确认</footer><script src="${prefix}market.js" defer></script></body></html>\n`
}
const trustLabel = value => value === 'verified-publisher' ? '已验证发布者' : value === 'builtin' ? 'DeepRunner 内置' : '严选社区'
const listed = catalog.entries.filter(entry => entry.status !== 'deprecated')
const cards = listed.map(entry => `<a class="card" data-plugin-card data-level="${escape(entry.trustLevel)}" data-search="${escape(`${entry.displayName} ${entry.publisher} ${entry.summary} ${entry.tags.join(' ')}`.toLocaleLowerCase())}" href="${base}plugin/${encodeURIComponent(entry.id)}/"><div class="card-head"><div class="icon">${escape(entry.displayName.trim()[0] ?? 'P')}</div><div><h2>${escape(entry.displayName)}</h2><div class="publisher">${escape(entry.publisher)}</div></div></div><p class="summary">${escape(entry.summary)}</p><div class="badges"><span class="badge">${escape(trustLabel(entry.trustLevel))}</span><span class="badge">v${escape(entry.release.version)}</span>${entry.status === 'paused' ? '<span class="badge warn">暂停安装</span>' : ''}</div></a>`).join('')
const home = `<section class="shell hero"><div class="eyebrow">Curated plugin market</div><h1>为 DeepRunner 精选的插件。</h1><p>浏览经过人工收录、版本精确固定且带完整性信息的插件。网页只负责展示；点击安装后，由本机 DeepRunner 再次校验目录并请求你的明确确认。</p><div class="toolbar"><input data-search type="search" placeholder="搜索名称、发布者或标签" aria-label="搜索插件"><select data-trust aria-label="按信任等级筛选"><option value="all">全部信任等级</option><option value="verified-publisher">已验证发布者</option><option value="community">严选社区</option><option value="builtin">DeepRunner 内置</option></select></div></section><section class="shell grid" data-market-list>${cards}</section><div class="shell empty" data-empty hidden>没有匹配的插件。</div>`

await rm(dist, { recursive: true, force: true })
await mkdir(resolve(dist, 'catalog/v1'), { recursive: true })
await cp(resolve(root, 'site/styles.css'), resolve(dist, 'styles.css'))
await cp(resolve(root, 'site/market.js'), resolve(dist, 'market.js'))
await cp(outputPath, resolve(dist, 'catalog/v1/catalog.json'))
await writeFile(resolve(dist, 'index.html'), layout('DeepRunner Plugins', 'DeepRunner 官方严选插件市场', home), 'utf8')
await mkdir(resolve(dist, 'trust'), { recursive: true })
const trust = `<article class="shell policy"><div class="eyebrow">Trust & curation</div><h1>信任标签不是安全保证。</h1><p>市场只收录经过人工选择、能固定到精确 npm 版本并带 registry integrity 的插件。安装第三方插件意味着在本机运行第三方代码。</p><h2>信任等级</h2><p><strong>DeepRunner 内置</strong>由客户端随包提供；<strong>已验证发布者</strong>表示发布者身份及发布流程经过核验；<strong>严选社区</strong>表示条目适合收录，但不代表发布者身份或每行代码都经过审计。</p><h2>安装安全边界</h2><p>网页链接只携带插件 id，不携带版本、下载地址或完整性值。DeepRunner 必须从自己的已验证目录重新解析插件，并继续执行预览、兼容性检查和用户确认。</p><h2>报告问题</h2><p>发现恶意行为、供应链异常或严重兼容问题，请通过 GitHub Security Advisory 私下报告；一般问题可提交 issue。</p></article>`
await writeFile(resolve(dist, 'trust/index.html'), layout('信任与审核 · DeepRunner Plugins', 'DeepRunner 插件市场信任与审核政策', trust, 1), 'utf8')
for (const entry of listed) {
  const dir = resolve(dist, 'plugin', entry.id)
  await mkdir(dir, { recursive: true })
  const deepLink = `deeprunner://market/plugin/${encodeURIComponent(entry.id)}`
  const body = `<article class="shell detail"><div class="eyebrow">${escape(trustLabel(entry.trustLevel))}</div><h1>${escape(entry.displayName)}</h1><p class="muted">${escape(entry.summary)}</p><div class="detail-layout"><section class="panel"><p class="description">${escape(entry.description)}</p><div class="notice">网页不会直接安装插件。DeepRunner 打开后会从自己的目录重新解析此 id，并要求你确认精确版本与权限风险。</div><div class="actions"><a class="button" href="${deepLink}">在 DeepRunner 中打开</a><button class="button secondary" type="button" data-copy-link="${deepLink}">复制链接</button>${entry.repository ? `<a class="button secondary" href="${escape(entry.repository)}" rel="noreferrer">查看源码</a>` : ''}</div><h2>能力提示</h2><div class="badges">${entry.release.capabilities.map(item => `<span class="badge warn">${escape(item)}</span>`).join('') || '<span class="muted">未声明额外能力</span>'}</div>${entry.release.releaseNotes ? `<h2>版本说明</h2><p class="description">${escape(entry.release.releaseNotes)}</p>` : ''}</section><aside class="panel"><dl class="facts"><div><dt>发布者</dt><dd>${escape(entry.publisher)}</dd></div><div><dt>精确规格</dt><dd>${escape(entry.release.exactSpec)}</dd></div><div><dt>许可证</dt><dd>${escape(entry.license)}</dd></div><div><dt>DSH</dt><dd>${escape(entry.release.dshVersionRange)}</dd></div><div><dt>平台</dt><dd>${escape(entry.release.platforms.join(' · '))}</dd></div><div><dt>Integrity</dt><dd>${escape(entry.release.distIntegrity)}</dd></div><div><dt>Source revision</dt><dd>${escape(entry.release.sourceRevision)}</dd></div></dl></aside></div></article>`
  await writeFile(resolve(dir, 'index.html'), layout(`${entry.displayName} · DeepRunner Plugins`, entry.summary, body, 2), 'utf8')
}
await writeFile(resolve(dist, 'catalog/v1/catalog.sha256'), `${sha256(await readFile(outputPath))}  catalog.json\n`, 'utf8')
await writeFile(resolve(dist, '.nojekyll'), '', 'utf8')
console.log(`built market site with ${listed.length} plugin page(s) at ${dist}`)
