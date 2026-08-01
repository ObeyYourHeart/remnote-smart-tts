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
- Real queue feedback showed no widget on a Multi-Line card. `FlashcardUnder.cardId` is optional, but 0.7 returned `null` whenever it was absent. Structured queue items may also expose a child Rem, so detection must resolve the card Rem and then climb one level to the Multi-Line parent.

## Real queue evidence for 0.7.1

- The local DEV plugin visibly rendered its compact play/settings widget on a Single-Line card and on a Cloze card in the user's current Chrome RemNote queue.
- This rules out a general localhost connection, widget registration, or CSS failure for the missing Multi-Line control.
- The remaining failure matched two planner assumptions: `cardId` was treated as required even though the SDK marks it optional, and only the exact context Rem was checked for the `MultiLineCard` powerup.
- The repaired resolver checks `card.getRem()`, falls back to the context Rem, and accepts either the current Rem or its parent as the Multi-Line root.

## Live 0.7.1 blank-widget evidence

- On the user's Descriptor queue card, RemNote loaded `http://localhost:8081/index.html?widgetName=flashcard-speech&pluginId=card-speech-studio-dev` at 82 by 38 pixels.
- The queue did not show the control contents, so DEV connectivity, widget registration, and the outer positioning CSS are not the cause. The widget mounted but its planner returned no usable plan or encountered an internal error.
- The same RemNote page also loaded the zero-height DEV index widget, confirming the local plugin instance is active.
- Direct iframe-body inspection timed out. Continue with console logs and non-secret runtime diagnostics rather than repeating that operation.
- Development and production are deliberately separate plugin identities: Webpack rewrites localhost to `card-speech-studio-dev` / `Smart Flashcard TTS [DEV]`, while the GitHub-installed plugin remains `card-speech-studio`. RemNote showing production 0.3.0 does not describe the localhost DEV build.
- Localhost now serves DEV version 0.7.2 and compiled the card planner hot update successfully.
- A fresh same-account Chrome queue tab showed the live `Smart Flashcard TTS` iframe buttons on the exact `市销率 / 算法 / ?` card after the 0.7.2 hot update.

## Live nested Descriptor Multi-Line card

- `eUpbXhkHXNHE2srjT` initially loaded the DEV widget but showed the disabled `暂时无法识别这张卡片` control for `市销率 / 缺陷 / 3`.
- RemNote exposes this as a semantic Descriptor with an empty back side and three direct card-item children, without the parent marker assumed by the previous reader.
- After allowing unmarked semantic cards to use direct `isCardItem()` children, the same live page changed to the enabled `朗读当前卡片面` control.
- The user requested each answer item to be spoken separately. Version 0.7.3 now supplies semantic speech segments; Azure uses one SSML request with sentence elements and 220 ms breaks, while browser speech uses separate utterances.

## Live List-Answer card

- `v7pk7h1J9BQuGGRCx` is the live queue card titled `把大象放入冰箱的顺序`.
- RemNote visibly renders a downward card arrow and the first numbered answer placeholder (`1.` / `3`), but the DEV widget is disabled as `暂时无法识别这张卡片`.
- No useful structured-card diagnostic was present in the captured top-level console logs, so the next step is to inspect the plugin's existing runtime diagnostics and resolver assumptions in source rather than retrying the same log query.
- The old planner only allowed unmarked direct card items when the parent was a Concept or Descriptor. This ordinary List-Answer has an empty back side and ordered card-item children, but no usable parent powerup in the queue path, so it was rejected before `isListItem()` classification.
- Version 0.7.4 treats direct SDK card-item markers as authoritative for any empty-back structured parent and can also climb from a current ordered child to an unmarked parent. The actual visible numbering remains presentation only and is not scraped.
- Two post-fix Chrome reads timed out, so live visual confirmation was stopped rather than repeatedly controlling the user's page.

## Incremental ordered-child behavior

- RemNote tests each ordered child Rem separately. Resolving that child to its structured parent is necessary for the shared question, but discarding the child identity caused version 0.7.4 to synthesize the entire parent answer on the first reveal.
- Version 0.7.5 preserves the ordered child Rem ID, finds its index among the parent's direct card items, and emits only one answer segment using the true parent-list ordinal.
- A parent-level ordered card still emits the full ordered answer. This keeps full-set and incremental review behavior distinct.
