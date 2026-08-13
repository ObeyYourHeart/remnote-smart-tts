<div align="center">

# RemNote Smart TTS

Structure-aware text-to-speech for RemNote flashcards.

Read a card as a question and an answer, preserve its note structure, and switch naturally between Chinese, English, and Japanese voices.

[Download plugin](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/PluginZip.zip) · [Releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases) · [简体中文](#简体中文)

[![Release](https://img.shields.io/github/v/release/ObeyYourHeart/remnote-smart-tts)](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f604d.svg)](LICENSE)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-9b51e0.svg)](https://www.remnote.com/)

</div>

## At a glance

| | Support |
| --- | --- |
| Languages | Chinese (`zh-CN`), English (`en-US`), Japanese (`ja-JP`) |
| Providers | Browser Speech · Azure Speech · Edge Local Voice |
| Card layouts | Basic · Concept · Descriptor · Cloze · Multi-Line · List-Answer · Ordered |
| Platforms | RemNote in Chrome, Edge, or the desktop app |

## English

### Why Smart TTS?

Most text-to-speech tools read the visible card as one block. RemNote Smart TTS first builds a speech plan from the card structure:

- Concept and Descriptor paths become complete, self-contained questions.
- Nested notes keep their Concept → Descriptor → sub-Descriptor context.
- Clozes replace only the active blank and restore the complete sentence after reveal.
- Multi-Line and List-Answer cards introduce the set and read answer items separately.
- Ordered cards identify the current step instead of reading the entire list.
- Question and answer sides are planned independently, so bilingual cards can use different voices.

### Card structure support

| Structure | Spoken behavior |
| --- | --- |
| **Basic A → B** | Reads the question, then the answer after reveal. |
| **Concept** | Builds a definition prompt, such as “What is photosynthesis?” |
| **Descriptor** | Includes its parent Concept, such as “What are the inputs for photosynthesis?” |
| **Nested Descriptor** | Preserves the complete semantic path through deeply nested notes. |
| **Cloze** | Replaces the active blank with a configurable “what”, “什么”, or “なに”. |
| **Multi-Line / Set** | Asks what the set includes, then reads each answer item as a separate sentence. |
| **List-Answer / Ordered** | Reads the tested item with its ordinal, such as “What is the second step?” |
| **Structured descendants** | Keeps Concept/Descriptor context when a deeper A/B, Cloze, or list card is tested. |

### Install

#### RemNote plugin

1. Download [`PluginZip.zip`](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/PluginZip.zip).
2. Upload it through RemNote’s plugin installation flow.
3. Open **RemNote Settings → Plugins → RemNote Smart TTS**.

#### Optional: Edge Local Voice

Edge Local Voice uses Microsoft Edge’s online neural voices through a small local `edge-tts` bridge. It is useful when you want voices such as Xiaoxiao, Yunxi, Aria, or Nanami without entering an Azure key.

1. Install Python 3.9 or newer.
2. Download [`EdgeLocalService.zip`](https://github.com/ObeyYourHeart/remnote-smart-tts/releases/latest/download/EdgeLocalService.zip).
3. Extract it and run `scripts/start-edge-tts.ps1`.
4. Select **Edge Local Voice** in the plugin settings.
5. Open **Advanced Voice Setup**, choose voices, and preview them.

The bridge must be running during review. The included startup helper can launch it with Windows. Speech synthesis still requires an internet connection because the bridge forwards text to Microsoft’s Edge speech service.

### Configure

| Setting | Purpose |
| --- | --- |
| **Autoplay mode** | Off, Question only, Answer only, or Question and answer. |
| **Voice provider** | Browser Speech, Azure Speech, or Edge Local Voice. |
| **Language voices** | Select a voice independently for Chinese, English, and Japanese. |
| **Browser fallback** | Use a browser voice when an external provider is unavailable. |
| **Rate and volume** | Adjust playback without changing card text. |
| **Cloze prompts** | Customize the spoken replacement for the active blank in each language. |
| **Replace RemNote TTS controls** | Hide the visible Front/Back row without changing RemNote preferences. |

### Provider notes

<details>
<summary><strong>Browser Speech</strong></summary>

Uses the Web Speech API exposed by the current browser and operating system. It is free and requires no credentials, but available voices vary by platform. Chrome may not expose the same online neural voices as Microsoft Edge.

</details>

<details>
<summary><strong>Azure Speech</strong></summary>

Uses your own Azure Speech resource, key, and region. **Advanced Voice Setup** can load the available catalog for the supported locales and lets you select voices independently. Long structured answers are divided into safe semantic batches, while ordinary cards stay in one synthesis request where possible.

The Speech Key is stored only in local RemNote plugin storage. It is never committed to this repository or written to synchronized settings. Only the text being synthesized is sent to your configured Azure Speech endpoint. Azure usage may incur charges under your Microsoft subscription.

</details>

<details>
<summary><strong>Edge Local Voice</strong></summary>

The bridge listens on `127.0.0.1` and accepts requests only from RemNote and localhost development pages. It does not contain an Azure key. Switching cards cancels unfinished local synthesis requests to avoid stale audio.

</details>

### RemNote’s built-in TTS

The public RemNote Plugin SDK does not expose a supported way to read or disable RemNote’s own TTS preference. If two voices play at once, turn off RemNote Queue TTS or set this plugin’s autoplay mode to **Off**. **Replace RemNote TTS controls** changes only the visible queue UI; it does not modify RemNote preferences.

### Privacy and known limits

- Browser Speech stays in the browser.
- Azure keys stay in local plugin storage and are not synchronized or committed.
- The Edge bridge is loopback-only and rejects untrusted origins.
- No credentials are included in the repository or release packages.
- The public SDK does not reliably expose the correct choice for Multiple-Choice cards, so the plugin does not guess it.
- Tables, image occlusion, and some complex LaTeX Clozes need richer structured data from RemNote.
- Browser autoplay policies can block automatic playback in some iframe or mobile contexts; manual playback remains available.

### Development

```powershell
npm install
npm run check-types
npm test
npm run build
```

The build creates `PluginZip.zip` and `EdgeLocalService.zip`. The localhost development build uses a separate `-dev` plugin ID so it can coexist with a production installation.

## 简体中文

RemNote Smart TTS 是一个面向 RemNote 复习队列的结构化朗读插件。它先理解卡片的语义结构，再生成问题和答案，而不是把整张卡片当成一段普通文本朗读。

### 支持的结构

| 结构 | 朗读方式 |
| --- | --- |
| **Basic A → B** | 先朗读问题，显示答案后再朗读答案。 |
| **Concept** | 将概念组织成完整的定义问题。 |
| **Descriptor** | 将父级 Concept 和当前 Descriptor 组合成完整问题。 |
| **嵌套 Descriptor** | 保留 Concept → Descriptor → 子 Descriptor 的完整路径。 |
| **Cloze** | 当前挖空使用可配置的“什么 / what / なに”，揭示后恢复完整句子。 |
| **Multi-Line / Set** | 先说明集合包含哪些内容，再逐项朗读答案。 |
| **List-Answer / Ordered** | 只朗读当前测试的第几项和该项内容。 |
| **结构化子卡片** | 深层的普通 A/B、Cloze、Multi-Line 或 List-Answer 仍保留上层语义。 |

### 安装

1. 从 [Releases](https://github.com/ObeyYourHeart/remnote-smart-tts/releases) 下载 `PluginZip.zip`。
2. 通过 RemNote 的插件安装流程上传。
3. 在 **RemNote 设置 → 插件 → RemNote Smart TTS** 中配置日常选项。

使用 Edge Local Voice 时，再下载 `EdgeLocalService.zip`，解压后运行 `scripts/start-edge-tts.ps1`，然后在插件设置中选择 **Edge Local Voice**。

### 声音来源

- **Browser Speech**：免费，不需要密钥，但声音取决于浏览器和操作系统。
- **Azure Speech**：使用自己的 Azure Speech 资源、Key 和 Region，可动态加载可用声音目录。
- **Edge Local Voice**：通过本地 `edge-tts` 桥接服务使用微软 Edge 在线神经声音，不需要 Azure Key，但需要本地服务和网络连接。

Azure Key 只保存在本机 RemNote 插件 storage，不会提交到 GitHub，也不会写入同步设置。Edge 桥接服务只监听本机回环地址，并限制允许的来源。

### 本地开发

```powershell
npm install
npm run check-types
npm test
npm run build
```

构建结果为 `PluginZip.zip` 和 `EdgeLocalService.zip`。localhost 调试版使用独立的 `-dev` Plugin ID，可以与正式版并存。

## Acknowledgements / 致谢

Inspired by [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech), with independent extensions for card-structure parsing, multilingual speech, semantic prompts, and multiple speech providers.

本项目参考了 [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech)，并独立扩展了卡片结构解析、多语言朗读、语义提示和多种声音来源支持。

## License

[MIT](LICENSE)
