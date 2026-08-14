import type { InterfaceLanguage, SpeechProvider } from './types';

/** Returns the user-facing name for a speech provider in the selected UI language. */
export function speechProviderLabel(
  provider: SpeechProvider,
  language: InterfaceLanguage,
): string {
  if (language === 'zh') {
    if (provider === 'azure') return 'Azure Speech';
    if (provider === 'edge-local') return 'Edge 本地语音';
    return '浏览器声音';
  }

  if (provider === 'azure') return 'Azure Speech';
  if (provider === 'edge-local') return 'Edge Local Voice';
  return 'Browser Speech';
}

/** Explains an external-provider fallback without naming the wrong provider. */
export function formatProviderFallbackNotice(
  requestedProvider: SpeechProvider,
  language: InterfaceLanguage,
  reason: string,
): string {
  const requested = speechProviderLabel(requestedProvider, language);
  const browser = speechProviderLabel('browser', language);

  return language === 'zh'
    ? `${requested} 暂不可用，已改用${browser}：${reason}`
    : `${requested} was unavailable, so ${browser} is being used: ${reason}`;
}
