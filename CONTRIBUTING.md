# 维护目录

每个插件对应 `plugins/` 下一个 JSON 文件。修改条目时应同时核对 npm 精确版本、`dist.integrity`、源码 revision、发布时间、DSH 兼容范围和能力提示。

```sh
npm run build
npm run check
```

生成后的 `public/catalog/v1/catalog.json` 必须一并提交。这个仓库只接受外部人工审核流程已经决定收录的插件，不自动采集互联网条目。信任等级来自仓库外的审核流程；目录维护者不能仅根据 Star、下载量或插件自述把条目提升为 `verified-publisher`。

更新版本时禁止使用 `latest` 或 semver range 作为 `exactSpec`。目录发布物始终固定为 `<packageName>@<version>`，并记录 registry 返回的 SRI integrity。
