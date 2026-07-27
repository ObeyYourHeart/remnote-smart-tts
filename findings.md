# 设计记录

- Chrome 通常不能直接使用 Edge 专属的 Online Natural Voice；高质量晓晓通过用户自己的 Azure Speech 配置提供。
- Azure Key 只存 `plugin.storage.local`，不进入同步 storage、源码或 Git。
- 中文默认 `zh-CN-XiaoxiaoNeural`，日文默认 `ja-JP-NanamiNeural`。
- 浏览器模式作为免费回退，具体声音取决于 Chrome/Windows 暴露的 voice 列表。
- Flashcard widget context 提供 `remId`、`cardId`、`revealed`，Card 提供 forward、backward 或 clozeId。
- Azure Speech SDK 使用 dynamic import；浏览器声音模式不会在每张卡片上预先加载 Azure 模块。

## RemNote 官方 TTS 冲突研究

- RemNote 已有 Queue Text to Speech，可在 Settings → Queue → Text to Speech 配置，并可能设置为展示卡片时自动播放。
- 官方帮助中心确认 Advanced Tables 的卡片列可以单独启用 Text to Speech，并可用标准 voice 或付费 ElevenLabs voice。
- 因而冲突不是“插件 API 名称冲突”，而是同一张卡在 question/reveal 事件上被 RemNote 和本插件各播放一次。
- 当前 SDK 的 Flashcard widget context 没有暴露“官方 TTS 是否开启”的状态，也没有受支持的 API 可以替用户关闭官方 TTS。
- 安全策略：插件首次安装默认关闭自动朗读；设置页明确要求二选一，并提供手动重播。用户确认已关闭 RemNote 官方自动 TTS 后，再开启本插件的 question/answer autoplay。
- 不能通过 DOM 猜测或强行停止 RemNote 官方 audio；这种做法不稳定，也会误停用户插入的正常音频。

## GitHub 发布状态

- GitHub 连接身份：`ObeyYourHeart`。
- GitHub 连接器目前没有已安装仓库账户，并且不提供创建 repository 的动作；需要先建立一个公开空仓库或向连接器授予仓库访问权限。
