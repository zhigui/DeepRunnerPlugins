# GitHub Pages 市场站点预留方案

状态：仅规划，本期不实现。

## 目标

未来由同一份插件目录数据生成一个可供用户浏览的静态市场站点，并通过 GitHub Pages 发布。网页是目录的只读展示层，不参与插件安装，也不改变目录信任结论。

## 预留边界

- `plugins/*.json` 是人工维护的单插件源数据。
- `public/catalog/v1/catalog.json` 是 DeepRunner 和未来网页共同消费的稳定机器接口。
- `schema/market-catalog.schema.json` 固定 v1 数据契约。
- 未来站点源码建议放在 `site/`，构建产物输出到临时目录，不手工维护第二份插件数据。
- 未来 Pages workflow 先运行 `npm run check`，再构建站点并发布；目录校验失败时禁止发布。
- 稳定目录 URL 保留 `/catalog/v1/catalog.json`，网页路由和前端框架可以独立演进。

## 未来页面

第一阶段只需要浏览、搜索、分类、信任标签、兼容信息和插件详情。安装按钮使用文档型引导或 DeepRunner deep link；浏览器页面本身不得执行本地命令。

后续可以增加多语言、截图、更新日志、历史版本和撤回公告，但不在本期实现。

## 本期明确不做

- 不启用 GitHub Pages。
- 不加入站点框架或前端依赖。
- 不创建 Pages deploy workflow。
- 不在网页实现安装、审核、登录、评分或评论。

