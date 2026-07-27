# Card Speech Studio

这是一个用于 RemNote 复习队列的多语言朗读插件。它会理解卡片方向和文字 Cloze，自动判断中文、英文或日文，并使用浏览器声音或 Microsoft Azure Neural Voice 朗读。

## 主要功能

- 打开卡片后朗读问题，揭晓后朗读答案。
- 支持 Basic、Concept、Descriptor 的正向与反向卡片。
- Cloze 只替换当前被提问的空格，按附近文字说成“什么”、`what` 或“なに”。
- 中文、英文、日文可以分别选择声音。
- Chrome 中可通过 Azure 使用 `zh-CN-XiaoxiaoNeural`。
- Azure Speech Key 只保存在本机 RemNote storage，不参与同步。
- Azure 不可用时可自动退回浏览器声音。
- 内置官方 TTS 互斥锁，避免 RemNote 与插件同时自动朗读。

## 安装

最简单的方式：在 RemNote 的 Settings → Plugins 中选择从文件安装，然后选择项目根目录里的 `PluginZip.zip`。

从源码构建：

```powershell
npm install
npm run check-types
npm test
npm run build
```

## 声音模式

### Browser voices

免费；如果所选系统声音是本地声音，也可以离线使用。Chrome 只能使用 Web Speech API 暴露出来的声音，所以 Edge 专属的 Online Natural Voice 通常不会出现在这里。

### Azure Neural voices

需要你自己的 Azure Speech resource、Speech Key、Region 和网络连接。请在插件设置页中填写，Azure 可能按照你的订阅方案收费。

推荐默认声音：

- 中文：`zh-CN-XiaoxiaoNeural`
- 英文：`en-US-JennyNeural`
- 日文：`ja-JP-NanamiNeural`

## 避免与 RemNote 官方朗读冲突

RemNote 自带 Queue Text to Speech，Advanced Tables 也可以为列开启 TTS。RemNote Plugin SDK 暂未提供读取或关闭官方 TTS 的接口，因此本插件采用显式安全锁：

1. 在 RemNote Settings → Queue → Text to Speech 中关闭官方自动播放。
2. 在 Card Speech Studio 中勾选“我已关闭 RemNote 官方自动 TTS”。
3. 然后再开启问题面或答案面自动朗读。

新安装和从 0.1 升级时，自动朗读默认锁定为关闭；手动“重播”始终可用。本插件不会强行停止 RemNote 或卡片中的其他音频。

## 当前边界

0.2 版重点支持普通正反向卡和文字 Cloze，并加入官方 TTS 互斥保护。逐行揭晓、多选项随机顺序、表格、图片遮挡和 LaTeX Cloze 需要不同的朗读规则，暂未自动处理。

## 隐私

- 插件只申请 RemNote 只读权限。
- Azure Key 只存本机，不写入 `.env`、源码、截图或 Git。
- Browser 模式不会把文字发给 Azure；Azure 模式只向你配置的 Azure Speech resource 发送当前要朗读的文字。
