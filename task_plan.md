# 实施计划

- [x] 建立独立 RemNote React/TypeScript 插件项目。
- [x] 实现三语识别、RichText/Cloze 与卡片方向规则。
- [x] 实现 Browser Speech 与 Azure Speech 播放器。
- [x] 实现复习队列控件和设置界面。
- [x] 增加单元测试、类型检查、README 与正式构建。
- [x] 在独立 Git 仓库提交完成版本。

## 公开发布与冲突保护

- [x] 研究 RemNote 官方朗读功能的触发方式与可检测边界。
- [x] 增加“避免双重朗读”的设置、提示与安全默认值。
- [x] 重新运行测试、正式构建与密钥扫描。
- [x] 提交新版本并推送到公开 GitHub 仓库。
- [x] 将预定公开 Repo URL 写回 manifest 并生成最终安装版本。

## 0.7 Card Structure Speech Expansion

## Goal

Add reliable, structure-aware speech for RemNote Multi-Line and List-Answer cards, investigate the safe Multiple-Choice boundary, and preserve Single-Line, Concept/Descriptor, and Cloze behavior.

## Phases

### Phase 1: Research actual structures

**Status:** complete

- Inspect current plugin and installed SDK data models.
- Check official documentation and representative plugin implementations.

### Phase 2: Design speech plans

**Status:** complete

- Define question/answer output and safe fallbacks for each structure.

### Phase 3: Implement detection and rendering

**Status:** complete

- Keep each card-specific renderer in a small module.
- Bump the visible plugin version.

### Phase 4: Regression tests

**Status:** complete

- Add fixtures for all new structures and existing card kinds.

### Phase 5: Build and DEV verification

**Status:** complete

- Run type checks, tests, production build, and confirm localhost manifest.

### Phase 6: Local commit

**Status:** complete

- Commit verified changes without pushing GitHub.

### Phase 7: Real RemNote Multi-Line runtime repair

**Status:** complete

- Resolve a Multi-Line parent when the queue context points at a child card item.
- Support FlashcardUnder contexts whose optional `cardId` is absent.
- Add regression tests, bump the patch version, rebuild DEV, and commit locally.

### Phase 8: Blank Widget and installed-version diagnosis

**Status:** complete

- Inspect the live RemNote queue, DEV iframe, console output, and plugin manager version.
- Capture the real Multi-Line and Descriptor contexts instead of inferring them from SDK types.
- Repair empty-plan behavior, add regressions and visible diagnostics, bump the version, build, verify in Chrome, and commit locally.

### Phase 9: Live nested Descriptor Multi-Line card

**Status:** complete

- Inspect `eUpbXhkHXNHE2srjT` in the user's current Chrome session without grading or editing it.
- Determine the actual Widget state and the Rem/Card relationship for the nested `市销率 / 缺陷` card.
- Implement the smallest reliable fallback, add regression coverage, verify in the same card, and commit locally.

### Phase 10: Live List-Answer card

**Status:** complete

- Inspect `v7pk7h1J9BQuGGRCx` in the user's current browser without grading or editing it.
- Capture the actual parent and child metadata used by this List-Answer card.
- Repair ordered-card detection and segmented speech, add regression coverage, bump the patch version, build, verify live, and commit locally.

### Phase 11: Incremental List-Answer speech

**Status:** complete

- Preserve the active child Rem when resolving an ordered card to its parent.
- Speak only the active child answer with its true parent-list ordinal.
- Keep full-list speech for cards that genuinely reveal the whole ordered set.
- Add regressions, bump the patch version, run verification, build, and commit locally without pushing GitHub.

### Phase 12: Runtime incremental List evidence

**Status:** complete

- Inspect `kYFgwGCifpjBsZDK8` in the user's current Chrome session.
- Capture the actual FlashcardUnder context across question and reveal without grading the card.
- Explain why the 0.7.5 active-child assumption fails, implement the smallest verified correction, add regressions, build, and commit locally.

### Phase 13: Localized ordered-step questions

**Status:** complete

- Verify the exact ordered card page and its visible current-item marker.
- Generate a localized question for the tracked List-Answer item in Chinese, English, and Japanese.
- Preserve whole-list prompts and backward cards, then test, build, verify DEV, and commit locally.

## Constraints

- Do not control the user's Chrome unless explicitly requested.
- Do not upload or push to GitHub.
- Prefer RemNote SDK metadata over DOM/icon heuristics.
- Preserve Concept + Descriptor as the primary semantic note structure.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Combined `rg` scan returned exit 1 for a no-match query | 1 | Split SDK and reference-project searches instead of repeating the combined command. |
| Minified SDK search included missing `index.lib.js` and noisy bundled output | 1 | Use precise declaration ranges and stable API methods instead. |
| Web reader rejected scoped unpkg declaration URLs | 1 | Inspect the official npm package tarball locally instead of retrying the same URLs. |
| README/manifest inspection referenced missing root `manifest.json` | 1 | Use the actual `public/manifest.json` source file. |
| `rg` used Unix-style recursive globs on Windows | 1 | Search the SDK directory and apply `--glob '*.d.ts'`. |
| Node test runner failed every file with `spawn EPERM` | 1 | Re-run the unchanged test command with the required Windows execution permission. |
| Structure integration test hit `ReferenceError: self is not defined` | 1 | Define a test-only browser `self` global before dynamically importing the RemNote SDK-dependent planner. |
| RemNote validator build hit `spawnSync cmd.exe EPERM` | 1 | Re-run the unchanged production build with the required Windows execution permission. |
| New planning sections initially replaced earlier project history | 1 | Restore the tracked history and append the 0.7 records under separate sections before committing. |
| Real Multi-Line card rendered no playback control | 1 | The 0.7 planner incorrectly required optional `cardId` and assumed `context.remId` was always the Multi-Line parent; repair both assumptions. |
| Existing RemNote tabs were intermittently slow to attach | 1 | Opened one temporary tab in the same signed-in Chrome session and limited inspection to the current RemNote queue. |
| RemNote DOM inspection timed out repeatedly after HMR | 2 | Verified the runtime path with targeted regression tests, build validation, and the DEV manifest; leave the final Multi-Line visual confirmation to a clean queue reload. |
| Reading inside the DEV iframe timed out and reset browser control | 1 | Switch to top-level iframe metadata and captured console logs instead of repeating the frame-body read. |
| Node test workers were blocked with `spawn EPERM` in the sandbox | 1 | Re-run the unchanged test command with the existing approved Windows permission. |
| Two new structured-plan tests initially failed | 1 | Make the resolved Card Rem authoritative over the broader widget context and complete the child-card fixture with `isCardItem()`. |
| Post-HMR Chrome snapshot timed out and reset browser control | 1 | Use one isolated same-account RemNote tab for a final lightweight check; do not retry the claimed page snapshot. |
| Clicking Show Answer timed out after the card became supported | 1 | Do not repeat the click; reconnect once and inspect the resulting state read-only. |
| Reconnected answer-side snapshot also timed out | 2 | Stop browser retries; retain the confirmed enabled question-side control and ask the user to audibly verify the new answer segmentation after the build. |
| Requested widget file path did not exist | 1 | Use the actual lowercase `src/widgets/flashcard-speech.tsx` path found by `rg`. |
| DEV port inspection found no listener and then passed a null PID to `Get-Process` | 1 | Start the local DEV server before live HMR verification and avoid repeating the null-PID lookup. |
| Combined RemNote reload and full DOM snapshot timed out | 1 | Do not repeat the combined operation; reconnect once and use a lightweight read-only snapshot. |
| Reconnected lightweight List-Answer snapshot also timed out | 2 | Stop Chrome retries and complete verification through exact structure regressions, DEV manifest, and production build. |
| The first controlled Show Answer click timed out | 1 | Do not repeat the click; reconnect once and inspect the resulting page state and DEV diagnostic logs read-only. |
| Reconnected post-reveal page snapshot also timed out | 2 | Stop Chrome retries and inspect SDK widget/event surfaces plus runtime Card metadata instead. |
