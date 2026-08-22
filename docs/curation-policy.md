# 严选目录原则

DeepRunner Market 是人工严选目录，不是 npm 或 GitHub 的自动聚合页。任何插件只有在外部审核流程给出明确收录结论后，才可以通过变更 `plugins/*.json` 进入目录。

## 收录边界

- 不根据 Star、下载量、topic 或搜索排名自动收录。
- 不允许插件作者自行声明或提升信任等级。
- 每个版本固定 npm package、精确版本、artifact integrity 和源码 revision。
- 更新版本视为一次新的目录变更，不自动跟随 `latest`。
- 能力、兼容性、许可和来源必须明确；信息不足时不收录。
- 出现风险时通过 `paused`、`deprecated` 或 `revocations` 快速阻止安装或建议移除。

## 严选与信任等级

所有在架插件都经过“是否值得进入 DeepRunner Market”的人工选择。信任等级表达的是已经确认到什么程度，而不是区分“精选”和“未精选”：

- `builtin`：DeepRunner 随应用交付的系统组件。
- `verified-publisher`：外部流程确认了发布者身份或发布链路。
- `community`：人工选择收录并核对目录元数据，但未声明发布者身份已验证。

因此，`community` 仍属于严选市场，不等于从互联网自动抓取的未知插件。目录之外的 package/file/link 只能进入 DeepRunner 的“高级手动安装”流程，不能获得市场收录标签。

## 审核职责

具体审核记录、人员协作和发布者验证在独立仓库或流程中完成。这个数据仓库只接收最终结论并用 CI 守护机器契约，不在这里实现审核后台。

