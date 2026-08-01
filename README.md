# RemNote Smart TTS

[English](#english) · [简体中文](#简体中文)

[![Release](https://img.shields.io/github/v/release/ObeyYourHeart/remnote-smart-tts)](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f604d.svg)](LICENSE)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-9b51e0.svg)](https://www.remnote.com/)

## English

RemNote Smart TTS is a structure-aware speech plugin for the RemNote review queue. It reads a card as a question and an answer—not as an unstructured block of text—and switches among Chinese, English, and Japanese voices automatically.

### Card-aware speech

| Card structure | Spoken behavior |
|---|---|
| Basic | Reads the visible question, then the answer after reveal; forward and backward directions are supported. |
| Concept | Turns the Concept into a complete question and answer, such as “What is the P/E ratio?” |
| Descriptor | Includes the parent Concept, such as “What is the formula of the P/E ratio?” |
| Nested Descriptor path | Keeps every Descriptor from the nearest Concept through deeply nested sub-descriptors. |
| Cloze | Replaces only the active blank with `什么`, `what`, or `なに`; nested Clozes read their full Concept/Descriptor path, and answer-side Clozes keep the local A/B front. |
| Multi-Line / Set | Asks what the set includes, then reads answer children as separate semantic sentences. |
| Ordered List-Answer | Asks for the current step and reads only the item currently being tested. |

The question and answer sides are detected independently, so a bilingual card can use different voices on each side.

### Features

- Automatic question and answer playback with Off, Question, Answer, and Both modes.
- Chinese (`zh-CN`), English (`en-US`), and Japanese (`ja-JP`) language detection.
- Independent voice selection for each supported language.
- Compact queue control with manual play, stop, and advanced voice setup.
- Optional visual replacement of RemNote's built-in Front/Back TTS row.
- Browser Speech for a free, simple setup.
- An extensible speech-provider boundary, with Azure Speech as the first optional external provider.

### Voice providers

#### Browser Speech

Browser mode uses voices exposed through the Web Speech API. Availability depends on the browser and operating system. Chrome normally cannot access Edge-only Online Natural Voices.

#### Azure Speech

Azure mode uses your own Speech resource, key, and region. Advanced Voice Setup dynamically loads the complete Azure catalog compatible with `zh-CN`, `en-US`, and `ja-JP`, while curated presets remain available if the catalog request fails. The plugin streams compressed MP3 audio to reduce time to first sound. Azure usage may incur charges under your Microsoft subscription.

Within one review queue, the plugin reuses the Azure Speech connection after a completed utterance. The first utterance can still include Azure connection and model startup latency; later question and answer playback avoids repeating that connection handshake.

Azure playback is owned by the plugin's persistent index process rather than the temporary card control iframe. This keeps the connection alive when RemNote replaces the visible card UI; the card-local player remains available as a compatibility fallback.

The Speech Key is stored only in local RemNote plugin storage. It is never committed to this repository or placed in synchronized settings. Only text being synthesized is sent to the configured Azure Speech endpoint.

Other external speech providers may be added later without changing the card-structure layer.

### Installation

Install RemNote Smart TTS from the RemNote Plugin Store when available, or download the current release package:

- [Download PluginZip.zip](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/PluginZip.zip)
- [View releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases)

Everyday options live in **RemNote Settings → Plugins → RemNote Smart TTS**. Azure credentials, voice selection, and previews are grouped in **Advanced Voice Setup**.

### RemNote TTS coexistence

The RemNote Plugin SDK does not expose a supported way to read or disable RemNote's own TTS settings. If two voices play, turn off the corresponding RemNote Queue TTS option or set this plugin's autoplay mode to Off. The “Replace RemNote TTS controls” option changes only the visible queue UI; it does not modify RemNote preferences.

### Known limits

- Multiple-Choice correctness is not exposed reliably by the public Plugin SDK, so the plugin does not guess the correct answer.
- Full table narration, image-occlusion descriptions, and LaTeX Cloze interpretation need additional structured data from RemNote.
- Browser autoplay policies can still block audio in some iframe or mobile contexts; manual playback remains available.
- Dynamic Azure selection currently lists the three locales the plugin can synthesize correctly: `zh-CN`, `en-US`, and `ja-JP`.

### Development

```powershell
npm install
npm run check-types
npm test
npm run build
```

The production package is generated as `PluginZip.zip`. Localhost builds use a separate `-dev` plugin ID so they can coexist with an installed release.

---

## 简体中文

RemNote Smart TTS 是一个理解卡片结构的 RemNote 复习队列朗读插件。它不会把卡片当作一整段文字机械朗读，而是根据问题面、答案面、卡片方向和语义结构组织更自然的语音，并自动切换中文、英文和日文声音。

### 卡片结构朗读

| 卡片结构 | 朗读方式 |
|---|---|
| Basic | 进入卡片时朗读问题，揭晓后朗读答案；支持正向和反向。 |
| Concept | 把概念组织成完整问答，例如“市盈率是什么？”“市盈率是……”。 |
| Descriptor | 带上所属 Concept，例如“市盈率的算法是什么？”“市盈率的算法是……”。 |
| 嵌套 Descriptor 路径 | 从最近的 Concept 开始保留每一级 Descriptor，不截断更深子级。 |
| Cloze | 只把当前挖空替换为 `什么`、`what` 或 `なに`；嵌套 Cloze 会朗读完整 Concept/Descriptor 路径，答案侧 Cloze 也会保留当前 A/B Rem 的问题侧。 |
| Multi-Line / Set | 用“包括什么”提问，再把各个答案 Rem 作为独立语义句依次朗读。 |
| Ordered List-Answer | 询问当前第几步，并只朗读当前正在测试的项目。 |

问题面和答案面会分别判断语言，因此中英或中日双语卡片可以在两面自动切换声音。

### 主要功能

- 自动朗读可选择关闭、仅问题、仅答案或问题与答案。
- 支持中文（`zh-CN`）、英文（`en-US`）和日文（`ja-JP`）检测。
- 三种语言分别选择声音。
- 卡片内只保留紧凑的播放、停止和高级设置入口。
- 可在视觉上替代 RemNote 自带的 Front/Back TTS 控件。
- Browser Speech 免费且配置简单。
- 声音来源采用可扩展结构；Azure Speech 是目前第一个可选外部服务，未来可以继续增加其他 API。

### 声音来源

#### 浏览器声音

浏览器模式使用 Web Speech API 提供的声音，具体列表取决于浏览器和操作系统。Chrome 通常无法使用 Edge 专属的 Online Natural Voice。

#### Azure Speech

Azure 模式需要你自己的 Speech resource、Key 和 Region。高级声音设置会动态加载 Azure 中与 `zh-CN`、`en-US`、`ja-JP` 兼容的完整目录；加载失败时仍可使用内置精选声音。插件以压缩 MP3 流式播放，从而缩短首次出声等待。Azure 可能按照你的 Microsoft 订阅产生费用。

Speech Key 只保存在 RemNote 插件的本机 storage，不会提交到仓库，也不会写入同步设置。只有当前需要合成的文字会发送到你配置的 Azure Speech endpoint。

### 安装

审核通过后可从 RemNote Plugin Store 安装，也可以下载最新安装包：

- [下载 PluginZip.zip](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/PluginZip.zip)
- [查看 Releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases)

日常选项位于 **RemNote 设置 → 插件 → RemNote Smart TTS**。Azure 凭据、声音选择和试听集中在 **Advanced Voice Setup / 高级声音设置**。

### 与 RemNote 官方 TTS 共存

RemNote Plugin SDK 目前没有提供读取或关闭官方 TTS 设置的可靠接口。如果听到两套声音，请关闭对应的 RemNote Queue TTS，或把本插件的自动朗读设为关闭。“替代 RemNote TTS 控件”只改变队列中的可见 UI，不会修改 RemNote 偏好。

### 已知限制

- 公开 Plugin SDK 不能可靠提供 Multiple-Choice 的正确选项，因此插件不会猜答案。
- 完整表格朗读、图片遮挡描述和 LaTeX Cloze 理解仍需要 RemNote 提供更多结构化数据。
- 某些 iframe 或移动端环境可能受浏览器自动播放策略限制，此时仍可手动播放。
- Azure 动态目录目前只展示插件能够正确合成的三个 locale：`zh-CN`、`en-US`、`ja-JP`。

### 本地开发

```powershell
npm install
npm run check-types
npm test
npm run build
```

生产安装包生成在项目根目录的 `PluginZip.zip`。localhost 调试版使用独立的 `-dev` Plugin ID，可以与正式安装版共存。

## Acknowledgements / 致谢

Inspired by [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech), then independently extended with card-structure parsing, multilingual speech, semantic prompts, and provider controls.

本项目参考了 [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech)，并针对卡片结构、多语言、语义问答与声音来源管理进行了独立扩展。

## License

[MIT](LICENSE)
