# 实施计划

- [x] 建立独立 RemNote React/TypeScript 插件项目。
- [x] 实现三语识别、RichText/Cloze 与卡片方向规则。
- [x] 实现 Browser Speech 与 Azure Speech 播放器。
- [x] 实现复习队列控件和设置界面。
- [x] 增加单元测试、类型检查、README 与正式构建。
- [x] 在独立 Git 仓库提交完成版本。

## 公开发布与冲突保护（当前）

- [x] 研究 RemNote 官方朗读功能的触发方式与可检测边界。
- [x] 增加“避免双重朗读”的设置、提示与安全默认值。
- [x] 重新运行测试、正式构建与密钥扫描。
- [ ] 提交新版本并推送到公开 GitHub 仓库。
- [x] 将预定公开 Repo URL 写回 manifest 并生成最终安装版本。

## 首版范围

支持 Basic/Concept/Descriptor 正反向卡、文字 Cloze、中英日自动检测、问题/答案自动朗读、重播、停止与防重复。逐行揭晓、多选题顺序同步、表格、图片遮挡、LaTeX Cloze 和移动端留待实测后设计。

## 验证备注

- TypeScript 类型检查通过。
- 8 项语言与 Cloze 单元测试通过。
- 本机 Chrome 自动预览受到 Windows 本地页面/服务器加载异常影响，未作为正式构建的阻断条件。

## 错误记录

| 错误 | 尝试 | 处理 |
|---|---:|---|
| 本机未安装 `gh`，仓库也没有 GitHub remote | 1 | 请求安装 GitHub 插件；用户确认授权前继续完成本地冲突保护。 |
| PowerShell 密钥扫描正则的引号未闭合 | 1 | 拆成两条简单、只读的搜索命令，避免复杂转义。 |
| Chrome 控制 GitHub 页面连续超时 | 2 | 停止浏览器自动化，保留 New repository 页面，交由用户点击一次 Create repository。 |
