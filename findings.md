# 设计记录

- Chrome 通常不能直接使用 Edge 专属的 Online Natural Voice；高质量晓晓通过用户自己的 Azure Speech 配置提供。
- Azure Key 只存 `plugin.storage.local`，不进入同步 storage、源码或 Git。
- 中文默认 `zh-CN-XiaoxiaoNeural`，日文默认 `ja-JP-NanamiNeural`。
- 浏览器模式作为免费回退，具体声音取决于 Chrome/Windows 暴露的 voice 列表。
- Flashcard widget context 提供 `remId`、`cardId`、`revealed`，Card 提供 forward、backward 或 clozeId。
- Azure Speech SDK 使用 dynamic import；浏览器声音模式不会在每张卡片上预先加载 Azure 模块。
