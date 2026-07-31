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
- RemNote 官方维护公开的 React plugin template 和 official plugins 仓库。上传页要求 public GitHub Repo URL 是开发/安装来源验证，不等于插件已进入官方商店或已经过官方审核。

## 0.7 卡片结构研究

## User example

- RemNote card menu exposes Single-Line, Multi-Line, List-Answer, Cloze, and Multiple-Choice card structures.
- Existing plugin handles Single-Line and Cloze; Concept/Descriptor speech has also been added in versions 0.5–0.6.

## Research notes

- A local `rem-to-speech-research` checkout is available for comparison.
- RemNote `CardType` itself only exposes forward, backward, or Cloze; structural card variants therefore require Rem metadata, children, powerups, or another stable marker.
- The installed SDK exposes `rem.isCardItem()`, `rem.getChildrenRem()`, tags, powerups, and rich text, but its declarations contain no explicit Multi-Line/List-Answer/Multiple-Choice enum.
- The local `rem-to-speech-research` plugin only extracts nested rich-text children; it has no structure-aware queue-card implementation to reuse.
- Official docs define Multi-Line answers as direct child Rems marked as card items. Set cards reveal all children together; List-Answer cards use a numbered list and reveal/schedule items one by one.
- Official docs define Multiple-Choice answers as child options. The displayed order is randomized, and one or more options may be correct.
- Multi-Line cards may be nested recursively, but the top-level card shows only direct children by default. The speech plan should therefore read direct card-item children only.
- The SDK includes `BuiltInPowerupCodes.MultiLineCard = "w"`, which is a stable parent marker for Multi-Line-family cards.
- Official import syntax confirms that Multi-Line, List-Answer, and Multiple-Choice all use nested child items; List uses ordered items, while Multiple-Choice uses lettered choices and randomizes display order.
- The installed SDK has no public Multiple-Choice marker or correct-answer API. Correct choices can be changed after creation, so assuming the first child is always correct would be unsafe.
- Checked official SDK 0.0.46 (latest npm package shown by npm metadata): it still exposes only `isCardItem()` and `isListItem()` for child structure, with no public Multiple-Choice/correct-answer method.
- Therefore upgrading from SDK 0.0.34 would not solve Multiple-Choice correctness detection.
- SDK 0.0.46 `RemData` also contains only id/owner/parent/children/type/text/backText/timestamps; no hidden public card-structure field is available to plugins.
- The Flashcard, FlashcardAnswer, and FlashcardUnder widget contexts expose only `remId`, optional `cardId`, and `revealed`; they do not identify a current List item or Multiple-Choice correct option.
- Official Multiple-Choice documentation confirms that `/mcr` and `/mcw` can change correctness after creation. Repository/code search did not reveal a supported public correctness field, so child order is not a valid correctness signal.

### Proposed safe behavior

- Detect the Multi-Line family through the parent `MultiLineCard` powerup.
- Read only direct children whose `isCardItem()` is true.
- Treat card-item children that are also `isListItem()` as ordered List-Answer items; preserve order with localized ordinal prompts.
- Treat the remaining card-item children as a Set/Multi-Line answer and read them without implying order.
- Multiple-Choice remains blocked on reliable subtype/correct-answer metadata. Do not guess that the first child is correct.
