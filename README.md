# DeepRunner Plugins

DeepRunner 的 App Store 式严选插件市场数据源。这个仓库维护机器可验证的人工精选目录，不实现插件审核后台，也不抓取任意 npm/GitHub 搜索结果。

当前只收录一个用于 M5 真实安装链路测试的社区插件：[`dsh-better-sidebar@0.12.1`](https://github.com/omdsh-dev/DSH-better-sidebar)。该版本固定匹配 DeepRunner 当前的 DSH `0.1.0-rc.6` 基线；它不是上游最新版本。

## 目录结构

- `plugins/*.json`：每个插件的人工维护源条目。
- `catalog.config.json`：目录版本、来源和撤回信息。
- `public/catalog/v1/catalog.json`：构建生成、供 DeepRunner 消费的稳定 v1 目录。
- `schema/market-catalog.schema.json`：公开 JSON Schema。
- `scripts/`：零第三方依赖的确定性构建与严格校验。
- `docs/curation-policy.md`：人工严选边界及其与信任等级的关系。
- `docs/github-pages-plan.md`：未来 GitHub Pages 市场网页的架构预留。

## 本地校验

需要 Node.js 20 或更高版本，无需安装依赖。

```sh
npm run build
npm run check
```

CI 本期只校验源条目和已提交生成物一致，不部署 GitHub Pages。未来市场网页会直接复用 `public/catalog/v1/catalog.json`，不会维护另一份数据。

## 信任说明

所有在架插件都经过人工选择。`community` 表示该插件已被严选进入受控目录，但不表示发布者身份或每个版本的代码已经完成安全审计。artifact integrity、兼容性、目录状态和能力提示都是独立字段。详细原则见 [`docs/curation-policy.md`](docs/curation-policy.md)。

审核、发布者验证和下架决策发生在仓库外；本仓库只记录最终结果。
