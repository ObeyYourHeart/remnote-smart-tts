# 开发进度

- 2026-07-27：完成上游插件、RemNote SDK、RemNote 卡片结构和 Microsoft Speech voice 研究。
- 2026-07-27：完成三语检测、Cloze、卡片方向、Browser/Azure 播放、队列控件和设置页。
- 2026-07-27：通过类型检查和 8 项单元测试；进入正式打包和提交阶段。
- 2026-07-27：收到公开 GitHub 发布要求；开始研究 RemNote 官方语音冲突并准备 0.2 版。
- 2026-07-27：确认官方 Queue/Table TTS 可能与插件同时播放；SDK 无法读取或关闭官方 TTS，决定使用默认关闭 autoplay 与明确互斥提示。
- 2026-07-27：GitHub 连接识别用户 `ObeyYourHeart`，但尚无可访问仓库。
- 2026-07-27：完成 0.2 TTS 互斥锁、10 项测试、官方构建和密钥扫描；等待公开仓库创建后推送。
- 2026-07-27：公开仓库 `ObeyYourHeart/card-speech-studio` 创建完成，本地 `main` 已成功推送。
- 2026-07-27：创建 GitHub Release `v0.2.0`，上传正式构建 `PluginZip.zip` 供 RemNote 安装。
- 2026-07-28：插件与仓库正式改名为 `Smart Flashcard TTS` / `ObeyYourHeart/smart-flashcard-tts`；内部插件 ID 保持不变以兼容升级。
- 2026-07-29：v0.3 将日常选项迁移到 RemNote 原生插件设置，重做中英双语高级声音页与极简卡片控件，并修复生产包未加载 widget CSS 的问题。

## 0.7 Multi-Line / List-Answer

- Started structure-aware speech expansion for Multi-Line, List-Answer, and Multiple-Choice cards.
- Created persistent plan and research notes.
- Located the local reference plugin. A combined `rg` scan returned exit code 1 when one query had no matches; subsequent research will run the searches separately.
- Confirmed that the SDK Card object does not identify the three structural variants directly; continued research must locate stable Rem metadata or use conservative structural inference.
- Read official card-creation and Multi-Line/List documentation. Established direct-child scope and the difference between Set and ordered List cards.
- A broad search of the minified SDK referenced a non-existent `index.lib.js` path and produced unusable output; switched back to declaration files and targeted metadata checks.
- Found the stable Multi-Line powerup marker and documented the public-API gap for Multiple-Choice correctness metadata.
- Direct web access to unpkg declarations was rejected as an unsafe URL. Next attempt will inspect the npm package tarball in a workspace temporary folder.
- Downloaded and inspected official SDK 0.0.46 in a temporary directory. Confirmed the public Multiple-Choice metadata gap remains.
- Confirmed all public flashcard widget contexts contain no sub-card or correct-option metadata. The safe implementation can fully support Multi-Line/Set and ordered List speech, but cannot truthfully announce Multiple-Choice correctness.
- A README/manifest inspection command referenced a root `manifest.json` that does not exist; the project manifest is correctly located at `public/manifest.json`.
- A Windows `rg` command used shell-style recursive globs and failed with error 123; subsequent searches use `rg <directory> --glob '*.d.ts'`.
- Initial 0.7 implementation compiles successfully. The first test run failed before loading any test because the sandbox blocked Node test-worker spawning with `spawn EPERM`; rerun the same suite outside that restriction.
- The first structure integration test imported the browser-only RemNote SDK bundle in Node and failed because `self` was undefined. Added a minimal test-only `self` compatibility global before dynamically importing the card planner.
- Version 0.7.0 passes type checking and all 29 tests. The first production build attempt was blocked by sandbox `spawnSync cmd.exe EPERM` inside RemNote's validation script; rerun the unchanged build with Windows execution permission.
- Production build and RemNote manifest validation passed; `PluginZip.zip` was regenerated.
- Local DEV server PID 37908 serves `Smart Flashcard TTS [DEV]` version 0.7.0 at port 8081.
- 2026-08-01：用户实测 Multi-Line 没有出现播放控件；开始修复可选 `cardId` 和子项上下文导致的空计划。

## 0.7.1 Multi-Line runtime repair

- Real Chrome queue inspection confirmed that Single-Line and Cloze cards render the Smart Flashcard TTS widget, so the DEV connection, widget registration, and base styling are healthy.
- Fixed structured-card planning when `FlashcardUnder.cardId` is absent.
- Fixed Multi-Line resolution when RemNote identifies a direct child card item instead of its Multi-Line parent.
- Added two regression tests. Type checking, all 31 tests, the RemNote production build, and the localhost DEV manifest passed at version 0.7.1.
- RemNote/Chrome DOM calls timed out repeatedly before a final post-HMR Multi-Line screenshot could be captured. The fix is verified at the planner/build/runtime-manifest layers; the user should reload the queue once for the final live visual check.

## 0.7.2 runtime diagnosis

- Started a new browser-backed investigation after the user confirmed both Multi-Line and Descriptor controls were blank.
- Confirmed the current Descriptor card has a live localhost DEV flashcard iframe, but the iframe renders no visible control content.
- Fixed the parent-overrides-Descriptor regression, resolved the active Rem through `Card.remId`, and added a non-blank unsupported-card state.
- Version 0.7.2 passes type checking, all 32 tests, RemNote manifest validation, and the production build.
- Real Chrome verification now shows `朗读当前卡片面` and `高级声音设置` on the user's `市销率 / 算法` queue card.

## 0.7.3 nested Descriptor Multi-Line

- Inspected the user's exact `市销率 / 缺陷` queue URL and reproduced the disabled unsupported-card state.
- Added unmarked Descriptor Multi-Line detection and confirmed the live control became enabled on the same card.
- Added per-item semantic speech segments with one-request Azure SSML pauses; type checking and all 34 tests pass.
- RemNote manifest validation and the production build pass at version 0.7.3; `PluginZip.zip` was regenerated.
