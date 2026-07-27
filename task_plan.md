# 实施计划

- [x] 建立独立 RemNote React/TypeScript 插件项目。
- [x] 实现三语识别、RichText/Cloze 与卡片方向规则。
- [x] 实现 Browser Speech 与 Azure Speech 播放器。
- [x] 实现复习队列控件和设置界面。
- [x] 增加单元测试、类型检查、README 与正式构建。
- [x] 在独立 Git 仓库提交完成版本。

## 首版范围

支持 Basic/Concept/Descriptor 正反向卡、文字 Cloze、中英日自动检测、问题/答案自动朗读、重播、停止与防重复。逐行揭晓、多选题顺序同步、表格、图片遮挡、LaTeX Cloze 和移动端留待实测后设计。

## 验证备注

- TypeScript 类型检查通过。
- 8 项语言与 Cloze 单元测试通过。
- 本机 Chrome 自动预览受到 Windows 本地页面/服务器加载异常影响，未作为正式构建的阻断条件。
