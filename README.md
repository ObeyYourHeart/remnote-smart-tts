# RemNote Smart TTS

Structure-aware text-to-speech for RemNote flashcards.

[English](#english) · [简体中文](#简体中文)

[![Release](https://img.shields.io/github/v/release/ObeyYourHeart/remnote-smart-tts)](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f604d.svg)](LICENSE)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-9b51e0.svg)](https://www.remnote.com/)

## English

RemNote Smart TTS reads the meaning of a flashcard instead of treating the card as one unstructured block of text. It understands common RemNote card layouts, builds a spoken question and answer, and switches voices when a card contains Chinese, English, or Japanese.

### Highlights

- Automatic playback for the question, answer, or both sides.
- Independent language detection for each side of a card.
- Concept and Descriptor prompts that preserve the semantic path of nested notes.
- Cloze prompts that replace the active blank with a configurable equivalent of “what”, “什么”, or “なに”.
- Multi-Line and List-Answer playback with separate semantic answer items.
- Ordered-card prompts such as “What is the second step?” rather than reading the entire list at once.
- Browser Speech, Azure Speech, and Edge Local Voice providers.
- Separate voice selection for Chinese (`zh-CN`), English (`en-US`), and Japanese (`ja-JP`).
- Optional visual replacement for RemNote’s built-in Front/Back TTS controls.
- Cancellation of stale requests when the active card changes.

### Supported card structures

| Structure | Spoken result | Example |
| --- | --- | --- |
| Basic A → B | Reads the question, then the answer after reveal. | “What is photosynthesis?” → “Photosynthesis converts light energy into chemical energy.” |
| Concept | Turns a Concept into a complete definition question. | “What is photosynthesis?” |
| Descriptor | Includes the parent Concept and the Descriptor. | “What are the inputs for photosynthesis?” |
| Nested Descriptor | Keeps the full Concept → Descriptor → sub-Descriptor path. | “What is the role of chlorophyll in photosynthesis?” |
| Cloze | Replaces only the active blank and restores the full sentence when revealed. | “The capital of Australia is what?” |
| Multi-Line / Set | Introduces the set, then reads each answer item as its own sentence. | “What does a pour-over coffee recipe include?” followed by each item. |
| List-Answer / Ordered | Reads the item currently being tested and its ordinal position. | “What is the second step to brew the coffee?” |
| Concept/Descriptor descendants | Keeps the semantic parent when a deeper A/B, Cloze, Multi-Line, or List-Answer card is tested. | A nested note still explains the relevant parent concept. |

The question and answer are planned separately. This allows a bilingual card to use an English voice for the question and a Chinese or Japanese voice for the answer without losing the card’s structure.

### Voice providers

#### Browser Speech

Uses the Web Speech API exposed by the current browser and operating system. It is free and requires no credentials, but the available voices vary by platform. Chrome may not expose the same online neural voices that Microsoft Edge provides.

#### Azure Speech

Uses your own Azure Speech resource, key, and region. Advanced Voice Setup can load the available catalog for the supported locales and lets you select a voice independently for each language. Audio is streamed as compressed MP3 where possible, and unusually long structured answers are split into safe semantic batches.

The Speech Key is stored only in local RemNote plugin storage. It is never committed to this repository or written to synchronized settings. Only the text being synthesized is sent to the Azure Speech endpoint configured by you. Azure usage may incur charges under your Microsoft subscription.

#### Edge Local Voice

Uses a small local `edge-tts` bridge to access Microsoft Edge’s online neural voices from Chrome, Edge, or the RemNote desktop app. This is useful when you want voices such as Xiaoxiao, Yunxi, Aria, or Nanami without putting an Azure key into the plugin.

The bridge listens on loopback only and accepts requests from RemNote and localhost development pages. Speech synthesis still requires an internet connection because the text is forwarded to Microsoft’s Edge speech service.

Setup:

1. Install Python 3.9 or newer.
2. Download [EdgeLocalService.zip](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/EdgeLocalService.zip).
3. Extract it and run `scripts/start-edge-tts.ps1`.
4. In RemNote settings, select **Edge Local Voice** as the provider.
5. Open **Advanced Voice Setup**, choose voices, and preview them.

The service must be running while reviewing cards. The included startup helper can launch it with Windows.

### Installation

Install the plugin from the RemNote Plugin Store when it becomes available, or download the release packages:

- [PluginZip.zip](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/PluginZip.zip) — RemNote plugin
- [EdgeLocalService.zip](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/EdgeLocalService.zip) — optional Edge Local Voice bridge
- [All releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases)

Everyday controls are available in **RemNote Settings → Plugins → RemNote Smart TTS**. Provider credentials, local server settings, voice choices, and previews are grouped in **Advanced Voice Setup**.

### Configuration

- **Autoplay mode**: Off, Question only, Answer only, or Question and answer.
- **Voice provider**: Browser, Azure, or Edge Local Voice.
- **Language voices**: Choose one voice independently for Chinese, English, and Japanese.
- **Fallback to Browser**: Use a browser voice when an external provider is unavailable.
- **Speech rate and volume**: Adjust playback without changing the card text.
- **Cloze prompts**: Customize the spoken replacement for an active blank in each language.
- **Replace RemNote TTS controls**: Hide the visible Front/Back row while leaving RemNote’s own setting untouched.

### RemNote’s built-in TTS

The public RemNote Plugin SDK does not provide a supported way to read or disable RemNote’s own TTS preference. If two voices play at once, turn off RemNote Queue TTS or set this plugin’s autoplay mode to Off. The replacement option changes only the visible queue controls; it does not modify RemNote’s preferences.

### Privacy and security

- Browser Speech stays in the browser.
- Azure keys stay in local plugin storage and are not synchronized or committed.
- The Edge bridge binds to `127.0.0.1` and rejects untrusted origins.
- Switching cards cancels unfinished local synthesis requests.
- No credentials are included in the repository or release packages.

### Known limitations

- The public SDK does not reliably expose the correct choice for Multiple-Choice cards, so the plugin does not guess it.
- Tables, image occlusion, and some LaTeX-heavy Clozes need richer structured data from RemNote.
- Browser autoplay policies can block automatic playback in some iframe or mobile contexts; manual playback remains available.
- Azure and Edge Local Voice require network access. Edge Local Voice also requires the local bridge to be running.

### Development

```powershell
npm install
npm run check-types
npm test
npm run build
```

The production plugin is generated as `PluginZip.zip`. The build also creates `EdgeLocalService.zip`. The localhost development build uses a separate `-dev` plugin ID so it can coexist with a production installation.

## 简体中文

RemNote Smart TTS 是一个面向 RemNote 复习队列的结构化朗读插件。它不会把整张卡片当成一段普通文本，而是识别问题面、答案面、Concept、Descriptor、Cloze、Multi-Line 和有序答案等结构，先生成更自然的朗读句子，再按中文、英文、日文自动切换声音。

### 主要功能

- 自动朗读问题、答案，或两者。
- 问题面和答案面分别检测语言。
- Concept、Descriptor 以及多层嵌套 Descriptor 保留完整语义路径。
- Cloze 只替换当前正在测试的挖空位置，并可分别设置中文、英文、日文提示词。
- Multi-Line 和 List-Answer 按答案项分别朗读。
- 顺序卡只朗读当前测试步骤，并加入“第几步”的问题提示。
- 支持 Browser Speech、Azure Speech 和 Edge Local Voice。
- 中文、英文、日文可分别选择声音。
- 可选地隐藏 RemNote 官方 Front/Back TTS 控件。
- 切换卡片时取消过期的语音请求，减少串音和错误播放。

### 卡片结构示例

| 结构 | 朗读方式 |
| --- | --- |
| Basic A → B | 先读问题，显示答案后再读答案。 |
| Concept | 将概念组织成完整的定义问题。 |
| Descriptor | 将父级 Concept 和当前 Descriptor 组合成完整问题。 |
| 嵌套 Descriptor | 保留 Concept → Descriptor → 子 Descriptor 的完整路径。 |
| Cloze | 当前挖空位置使用可配置的“什么 / what / なに”，揭示后恢复完整句子。 |
| Multi-Line / Set | 先说明集合包含哪些内容，再逐项朗读答案。 |
| List-Answer / Ordered | 只朗读当前测试的第几项和该项内容。 |
| Concept/Descriptor 下的子卡片 | 深层的普通 A/B、Cloze、Multi-Line 或 List-Answer 仍保留上层语义。 |

例如，一个关于光合作用的 Concept 可以被朗读为“光合作用是什么？”，其下的 Descriptor 可以被朗读为“光合作用的输入是什么？”。这些示例只是说明规则，不要求你的笔记使用固定文本。

### 声音来源

- **Browser Speech**：免费、不需要密钥，但声音取决于浏览器和操作系统。
- **Azure Speech**：使用你自己的 Azure Speech 资源、Key 和 Region，可动态加载可用声音目录。
- **Edge Local Voice**：通过本地 `edge-tts` 桥接服务使用微软 Edge 在线神经声音，不需要 Azure Key，但需要本地服务和网络连接。

Azure Key 只保存在本机 RemNote 插件 storage，不会提交到 GitHub，也不会写入同步设置。Edge 桥接服务只监听本机回环地址，并限制允许的来源。

### 安装与开发

从 [Releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases) 下载 `PluginZip.zip` 并上传到 RemNote。使用 Edge Local Voice 时，再下载并运行 `EdgeLocalService.zip` 中的 `scripts/start-edge-tts.ps1`。

本地开发：

```powershell
npm install
npm run check-types
npm test
npm run build
```

构建结果为 `PluginZip.zip` 和 `EdgeLocalService.zip`。localhost 调试版使用独立的 `-dev` Plugin ID，可以与正式版并存。

### 已知限制

- 公开 Plugin SDK 无法稳定提供 Multiple-Choice 的正确选项，因此插件不会猜测答案。
- 表格、图片遮挡和部分复杂 LaTeX Cloze 仍受 RemNote 结构化数据限制。
- 某些 iframe 或移动端环境会受到浏览器自动播放策略影响，此时可以手动播放。
- Azure 需要有效订阅和网络连接；Edge Local Voice 还需要本地桥接服务保持运行。

## Acknowledgements / 致谢

Inspired by [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech), with independent extensions for card-structure parsing, multilingual speech, semantic prompts, and multiple speech providers.

本项目参考了 [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech)，并独立扩展了卡片结构解析、多语言朗读、语义提示和多种声音来源支持。

## License

[MIT](LICENSE)
