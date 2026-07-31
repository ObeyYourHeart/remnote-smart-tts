# Smart Flashcard TTS

[English](#english) · [简体中文](#简体中文)

[![Release](https://img.shields.io/github/v/release/ObeyYourHeart/smart-flashcard-tts)](https://github.com/ObeyYourHeart/smart-flashcard-tts/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f604d.svg)](LICENSE)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-9b51e0.svg)](https://www.remnote.com/)

## English

### Overview

Smart Flashcard TTS provides complete, structure-aware card reading for the RemNote review queue. It understands flashcard direction and active text Clozes, detects Chinese, English, and Japanese independently on each card side, and supports both browser voices and Microsoft Azure Neural Voices.

### Highlights

- Reads the question when a card appears and the answer after reveal.
- Supports forward and backward Basic, Concept, and Descriptor cards.
- Reads native Multi-Line/Set answers and ordered List-Answer children in one smooth utterance.
- Replaces only the active Cloze with a language-aware prompt: `什么`, `what`, or `なに`.
- Detects the question and answer languages separately, allowing bilingual cards to switch voices automatically.
- Provides independent voice selection for Chinese, English, and Japanese.
- Supports `zh-CN-XiaoxiaoNeural` in Chrome through Azure Speech.
- Falls back to a browser voice when Azure is unavailable, if enabled.
- Offers one autoplay mode control: Off, Question only, Answer only, or Question and answer.
- Can visually replace RemNote's Front/Back TTS row with one compact voice control.

### Installation

Install from the RemNote Plugin Store after approval, or use the latest release package:

- [Download PluginZip.zip](https://github.com/ObeyYourHeart/smart-flashcard-tts/releases/latest/download/PluginZip.zip)
- [View all releases](https://github.com/ObeyYourHeart/smart-flashcard-tts/releases)

### Settings and card controls

Everyday controls are integrated into **RemNote Settings → Plugins → Smart Flashcard TTS** with English-first bilingual labels. This includes autoplay mode, Cloze prompts, provider, fallback language, rate, volume, and the optional replacement of RemNote's visible TTS row. **Advanced Voice Setup** keeps the Azure Speech Key and Region together, alongside voice selection and previews. The flashcard UI stays intentionally minimal: one voice/stop button and one advanced-setup button.

### Voice providers

#### Browser voices

Browser mode is free and can work offline when the selected system voice is local. Chrome can only use voices exposed through the Web Speech API; Edge-only Online Natural Voices are normally unavailable in Chrome.

#### Azure Neural Voices

Azure mode requires your own Azure Speech resource, Speech Key, Region, and internet connection. Azure usage may incur charges under your Microsoft subscription.

Chrome may block audio that starts automatically inside RemNote's cross-origin plugin iframe because RemNote does not grant that iframe the `autoplay` permission. The plugin detects this instead of showing a false success state. Manual playback from the centered speaker button still uses the selected Azure Neural Voice. Fully automatic Azure audio on initial queue entry would require either RemNote to grant `autoplay` or a separate browser extension running at the page level.

Recommended defaults:

| Language | Voice |
|---|---|
| Chinese | `zh-CN-XiaoxiaoNeural` |
| English | `en-US-JennyNeural` |
| Japanese | `ja-JP-NanamiNeural` |

### Preventing conflicts with RemNote TTS

RemNote provides its own Queue Text to Speech and table-column TTS. The Plugin SDK does not currently expose a supported way for a plugin to read or disable those settings. Smart Flashcard TTS therefore does not show a misleading confirmation switch or attempt to change RemNote's preferences.

Choose **Autoplay mode** in **Settings → Plugins → Smart Flashcard TTS**. If two voices play, set the plugin mode to **Off** or turn off the relevant RemNote TTS feature where it was enabled. Before its own playback, the plugin cancels active browser speech where the Web Speech API allows; it cannot forcibly stop RemNote audio or media embedded in cards.

### Privacy and permissions

- Requests read-only access to RemNote content.
- Stores the Azure Speech Key in local plugin storage, never synced storage.
- Does not include credentials in source code, environment files, releases, or Git history.
- Browser mode does not send text to Azure.
- Azure mode sends only the text currently being synthesized to the configured Azure Speech resource.

### Current scope

Version 0.7 adds native Multi-Line/Set and ordered List-Answer speech. It reads direct card-item children in one synthesis request, preserves List order, and keeps Concept + Descriptor prompts self-contained in Chinese, English, and Japanese. RemNote's public Plugin SDK does not expose Multiple-Choice correctness or the active incremental List item, so the plugin does not guess these answers. Randomized Multiple-Choice correctness, exact incremental List prompts, full table rendering, image occlusion descriptions, LaTeX Clozes, and mobile autoplay require future SDK support or an explicit user-authored marker.

### Development

```powershell
npm install
npm run check-types
npm test
npm run build
```

The production package is generated as `PluginZip.zip`.

---

## 简体中文

### 项目简介

Smart Flashcard TTS（智能卡片朗读）为 RemNote 复习队列提供完整、能够理解卡片结构的朗读。它能够识别卡片方向与当前文字 Cloze，分别判断问题面和答案面的中文、英文或日文，并使用浏览器声音或 Microsoft Azure Neural Voice 朗读。

### 核心功能

- 卡片出现时朗读问题，揭晓后朗读答案。
- 支持 Basic、Concept、Descriptor 正向与反向卡片。
- 支持原生 Multi-Line/Set 与有序 List-Answer，并把整面答案合成为一次流畅朗读。
- 只把当前被提问的 Cloze 替换成符合语境的“什么”、`what` 或“なに”。
- 问题与答案分别检测语言，中外文双语卡片可以自动切换声音。
- 中文、英文、日文可以独立选择 voice。
- Chrome 可通过 Azure 使用 `zh-CN-XiaoxiaoNeural` 晓晓声音。
- Azure 不可用时可选择自动退回浏览器声音。
- 提供统一的自动朗读模式：关闭、仅问题、仅答案、问题和答案。
- 可用一个紧凑的声音控件在视觉上替代 RemNote 官方 Front/Back 朗读行。

### 安装

审核通过后可从 RemNote 插件商店安装，也可以使用最新版安装包：

- [下载 PluginZip.zip](https://github.com/ObeyYourHeart/smart-flashcard-tts/releases/latest/download/PluginZip.zip)
- [查看全部版本](https://github.com/ObeyYourHeart/smart-flashcard-tts/releases)

### 设置与卡片控件

日常选项已经集成到 **RemNote 设置 → 插件 → Smart Flashcard TTS**，采用英文优先的中英双语标签，包括自动朗读模式、Cloze 用词、声音来源、默认语言、语速、音量，以及是否替代官方可见朗读行。**高级声音设置**把 Azure Speech Key 与 Region 放在一起，并提供声音选择和试听。卡片内默认只显示一个声音/停止按钮和一个高级声音设置按钮。

### 声音来源

#### 浏览器声音

浏览器模式免费；如果选择的是本地系统声音，也可以离线工作。Chrome 只能使用 Web Speech API 暴露的声音，因此 Edge 专属 Online Natural Voice 通常不会出现在 Chrome 中。

#### Azure Neural Voice

Azure 模式需要你自己的 Azure Speech resource、Speech Key、Region 和网络连接，并可能根据 Microsoft 订阅方案产生费用。

Chrome 可能会拦截 RemNote 跨域插件 iframe 中自动开始的声音，因为 RemNote 没有为该 iframe 提供 `autoplay` 权限。插件现在会准确报告这一情况，不再显示“已播放”但实际无声。手动点击卡片底部中央的扬声器仍会使用所选 Azure Neural Voice。若要在刚进入队列时全自动播放 Azure 声音，需要 RemNote 开放 `autoplay` 权限，或另做一个运行在页面层的浏览器扩展。

推荐默认声音：

| 语言 | Voice |
|---|---|
| 中文 | `zh-CN-XiaoxiaoNeural` |
| 英文 | `en-US-JennyNeural` |
| 日文 | `ja-JP-NanamiNeural` |

### 避免与 RemNote 官方朗读冲突

RemNote 自带 Queue Text to Speech，表格列也可以启用 TTS。Plugin SDK 目前没有提供让插件读取或关闭这些设置的可靠接口。因此 Smart Flashcard TTS 不再显示会造成误解的确认开关，也不会擅自修改 RemNote 的偏好。

请在 **设置 → 插件 → Smart Flashcard TTS** 中选择 **Autoplay mode / 自动朗读模式**。如果出现两套声音，把插件模式设为 **Off / 关闭**，或在原来启用它的位置关闭对应的 RemNote TTS。插件开始朗读前会在 Web Speech API 允许的范围内停止浏览器正在播放的语音，但无法强行停止 RemNote 音频或卡片内媒体。

### 隐私与权限

- 仅申请 RemNote 内容只读权限。
- Azure Speech Key 只保存在本机插件 storage，不参与同步。
- Key 不会写入源码、环境文件、Release 或 Git 历史。
- Browser 模式不会把文字发送给 Azure。
- Azure 模式只向你配置的 Azure Speech resource 发送当前需要合成的文字。

### 当前范围

0.7 版加入原生 Multi-Line/Set 和有序 List-Answer 朗读：只读取当前父卡的直接 card-item 子项，List 保留顺序，并把整面答案放进一次语音合成请求；Concept + Descriptor 仍使用中英日完整语义模板。RemNote 公开 Plugin SDK 目前不提供 Multiple-Choice 正确选项及当前逐项 List 子题，因此插件不会猜测答案。随机多选正确项、精确的逐项 List 提问、完整表格渲染、图片遮挡描述、LaTeX Cloze 和移动端自动播放仍需未来 SDK 支持或用户显式标记。

### 本地开发

```powershell
npm install
npm run check-types
npm test
npm run build
```

正式安装包会生成在项目根目录的 `PluginZip.zip`。

## Acknowledgements / 致谢

The project was inspired by [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech) and was independently extended for card-aware multilingual speech, active Cloze prompts, Azure voices, and explicit autoplay controls.

本项目参考了 [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech)，并针对卡片方向、多语言、当前 Cloze、Azure 声音及明确的自动朗读控制进行了独立扩展。

## License

[MIT](LICENSE)
