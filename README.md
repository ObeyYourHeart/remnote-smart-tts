# Smart Flashcard TTS

[English](#english) · [简体中文](#简体中文)

[![Release](https://img.shields.io/github/v/release/ObeyYourHeart/card-speech-studio)](https://github.com/ObeyYourHeart/card-speech-studio/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f604d.svg)](LICENSE)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-9b51e0.svg)](https://www.remnote.com/)

## English

### Overview

Smart Flashcard TTS provides complete, structure-aware card reading for the RemNote review queue. It understands flashcard direction and active text Clozes, detects Chinese, English, and Japanese independently on each card side, and supports both browser voices and Microsoft Azure Neural Voices.

### Highlights

- Reads the question when a card appears and the answer after reveal.
- Supports forward and backward Basic, Concept, and Descriptor cards.
- Replaces only the active Cloze with a language-aware prompt: `什么`, `what`, or `なに`.
- Detects the question and answer languages separately, allowing bilingual cards to switch voices automatically.
- Provides independent voice selection for Chinese, English, and Japanese.
- Supports `zh-CN-XiaoxiaoNeural` in Chrome through Azure Speech.
- Falls back to a browser voice when Azure is unavailable, if enabled.
- Includes an autoplay safety interlock to prevent duplicate speech with RemNote's built-in TTS.

### Installation

Install from the RemNote Plugin Store after approval, or use the latest release package:

- [Download PluginZip.zip](https://github.com/ObeyYourHeart/card-speech-studio/releases/latest/download/PluginZip.zip)
- [View all releases](https://github.com/ObeyYourHeart/card-speech-studio/releases)

### Voice providers

#### Browser voices

Browser mode is free and can work offline when the selected system voice is local. Chrome can only use voices exposed through the Web Speech API; Edge-only Online Natural Voices are normally unavailable in Chrome.

#### Azure Neural Voices

Azure mode requires your own Azure Speech resource, Speech Key, Region, and internet connection. Azure usage may incur charges under your Microsoft subscription.

Recommended defaults:

| Language | Voice |
|---|---|
| Chinese | `zh-CN-XiaoxiaoNeural` |
| English | `en-US-JennyNeural` |
| Japanese | `ja-JP-NanamiNeural` |

### Preventing conflicts with RemNote TTS

RemNote provides its own Queue Text to Speech and table-column TTS. The Plugin SDK does not currently expose a supported way to read or disable those settings, so Smart Flashcard TTS uses an explicit safety interlock:

1. Disable RemNote autoplay in **Settings → Queue → Text to Speech**.
2. In Smart Flashcard TTS, confirm **I have disabled RemNote's built-in autoplay TTS**.
3. Enable question-side and/or answer-side autoplay.

Autoplay is locked off for new installations and upgrades from 0.1 until this confirmation is made. Manual replay remains available. The plugin does not forcibly stop RemNote audio or media embedded in cards.

### Privacy and permissions

- Requests read-only access to RemNote content.
- Stores the Azure Speech Key in local plugin storage, never synced storage.
- Does not include credentials in source code, environment files, releases, or Git history.
- Browser mode does not send text to Azure.
- Azure mode sends only the text currently being synthesized to the configured Azure Speech resource.

### Current scope

Version 0.2 focuses on standard forward/backward cards and text Clozes. Multi-line incremental reveal, randomized multiple-choice order, full table rendering, image occlusion descriptions, LaTeX Clozes, and mobile autoplay require separate handling and are not yet automated.

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
- 只把当前被提问的 Cloze 替换成符合语境的“什么”、`what` 或“なに”。
- 问题与答案分别检测语言，中外文双语卡片可以自动切换声音。
- 中文、英文、日文可以独立选择 voice。
- Chrome 可通过 Azure 使用 `zh-CN-XiaoxiaoNeural` 晓晓声音。
- Azure 不可用时可选择自动退回浏览器声音。
- 内置自动朗读安全锁，避免与 RemNote 官方 TTS 重复播放。

### 安装

审核通过后可从 RemNote 插件商店安装，也可以使用最新版安装包：

- [下载 PluginZip.zip](https://github.com/ObeyYourHeart/card-speech-studio/releases/latest/download/PluginZip.zip)
- [查看全部版本](https://github.com/ObeyYourHeart/card-speech-studio/releases)

### 声音来源

#### 浏览器声音

浏览器模式免费；如果选择的是本地系统声音，也可以离线工作。Chrome 只能使用 Web Speech API 暴露的声音，因此 Edge 专属 Online Natural Voice 通常不会出现在 Chrome 中。

#### Azure Neural Voice

Azure 模式需要你自己的 Azure Speech resource、Speech Key、Region 和网络连接，并可能根据 Microsoft 订阅方案产生费用。

推荐默认声音：

| 语言 | Voice |
|---|---|
| 中文 | `zh-CN-XiaoxiaoNeural` |
| 英文 | `en-US-JennyNeural` |
| 日文 | `ja-JP-NanamiNeural` |

### 避免与 RemNote 官方朗读冲突

RemNote 自带 Queue Text to Speech，表格列也可以启用 TTS。Plugin SDK 目前没有提供读取或关闭这些设置的可靠接口，因此插件使用显式安全锁：

1. 在 **Settings → Queue → Text to Speech** 中关闭 RemNote 官方自动播放。
2. 在 Smart Flashcard TTS 中确认 **我已关闭 RemNote 官方自动 TTS**。
3. 再开启问题面和/或答案面自动朗读。

新安装或从 0.1 升级时，自动朗读默认保持锁定；手动重播始终可用。插件不会强行停止 RemNote 音频或卡片中插入的媒体。

### 隐私与权限

- 仅申请 RemNote 内容只读权限。
- Azure Speech Key 只保存在本机插件 storage，不参与同步。
- Key 不会写入源码、环境文件、Release 或 Git 历史。
- Browser 模式不会把文字发送给 Azure。
- Azure 模式只向你配置的 Azure Speech resource 发送当前需要合成的文字。

### 当前范围

0.2 版重点支持普通正反向卡和文字 Cloze。逐行揭晓、多选项随机顺序、完整表格渲染、图片遮挡描述、LaTeX Cloze 和移动端自动播放仍需要单独适配。

### 本地开发

```powershell
npm install
npm run check-types
npm test
npm run build
```

正式安装包会生成在项目根目录的 `PluginZip.zip`。

## Acknowledgements / 致谢

The project was inspired by [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech) and was independently extended for card-aware multilingual speech, active Cloze prompts, Azure voices, and RemNote TTS conflict protection.

本项目参考了 [mrcoding-dev/rem-to-speech](https://github.com/mrcoding-dev/rem-to-speech)，并针对卡片方向、多语言、当前 Cloze、Azure 声音及 RemNote 官方 TTS 冲突保护进行了独立扩展。

## License

[MIT](LICENSE)
