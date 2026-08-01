import type { InterfaceLanguage } from './types';

export type AzureSpeechErrorKind =
  | 'authentication'
  | 'quota'
  | 'configuration'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface AzureSpeechErrorClassification {
  kind: AzureSpeechErrorKind;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Maps unstable SDK wording to a small set of safe user-facing categories. */
export function classifyAzureSpeechError(error: unknown): AzureSpeechErrorClassification {
  const message = errorText(error).toLocaleLowerCase();

  if (/\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid (?:subscription )?key|authentication/u.test(message)) {
    return { kind: 'authentication' };
  }
  if (/\b429\b|quota|free tier|rate limit|too many requests|exceed(?:ed|s|ing)/u.test(message)) {
    return { kind: 'quota' };
  }
  if (/ssml|rootspeak|should not contain node|websocket error code:\s*1007/u.test(message)) {
    return { kind: 'configuration' };
  }
  if (/voice.*(?:not found|invalid|unsupported)|(?:not found|invalid|unsupported).*voice|region|endpoint|\b404\b/u.test(message)) {
    return { kind: 'configuration' };
  }
  if (/timeout|timed out/u.test(message)) return { kind: 'timeout' };
  if (/network|websocket|connection|dns|fetch|offline|socket|econn/u.test(message)) {
    return { kind: 'network' };
  }
  return { kind: 'unknown' };
}

/** Returns an actionable message without forwarding arbitrary SDK details. */
export function formatAzureSpeechError(error: unknown, language: InterfaceLanguage): string {
  const { kind } = classifyAzureSpeechError(error);
  if (language === 'zh') {
    switch (kind) {
      case 'authentication':
        return 'Azure Speech 认证失败，请检查 Speech Key 和 Region 是否属于同一资源。';
      case 'quota':
        return 'Azure Speech 额度或请求限制已达到，请检查订阅用量；Dragon HD 通常需要可用的付费层。';
      case 'configuration':
        return 'Azure Speech 的 Region 或所选声音不可用，请刷新声音目录并重新选择。';
      case 'network':
        return '无法连接 Azure Speech，请检查网络、代理和 Region endpoint。';
      case 'timeout':
        return 'Azure Speech 返回超时，请重试或改用响应更快的声音。';
      default:
        return 'Azure Speech 请求失败，请检查声音配置或稍后重试。';
    }
  }

  switch (kind) {
    case 'authentication':
      return 'Azure Speech authentication failed. Check that the Speech Key and Region belong to the same resource.';
    case 'quota':
      return 'Azure Speech quota or request limits were reached. Check subscription usage; Dragon HD usually needs an available paid tier.';
    case 'configuration':
      return 'The Azure Region or selected voice is unavailable. Refresh the voice catalog and choose the voice again.';
    case 'network':
      return 'Azure Speech could not be reached. Check the network, proxy, and Region endpoint.';
    case 'timeout':
      return 'Azure Speech timed out. Retry or choose a faster voice.';
    default:
      return 'Azure Speech failed. Check the voice configuration or try again later.';
  }
}
