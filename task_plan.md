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
