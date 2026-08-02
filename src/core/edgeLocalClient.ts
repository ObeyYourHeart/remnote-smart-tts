import type { EdgeLocalVoice } from './edgeVoiceCatalog';

export const DEFAULT_EDGE_LOCAL_URL = 'http://127.0.0.1:8765';

export interface EdgeTtsRequestPayload {
  text: string;
  voice: string;
  rate: string;
}

/** Keeps the local server URL clean and http(s)-only. */
export function normalizeEdgeLocalUrl(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_EDGE_LOCAL_URL;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_EDGE_LOCAL_URL;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_EDGE_LOCAL_URL;
  }
}

/** Converts the plugin rate (0.5-2.0) to edge-tts percent syntax. */
export function edgeLocalRatePercent(rate: number): string {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const delta = Math.round((safeRate - 1) * 100);
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}

export function buildEdgeTtsPayload(
  text: string,
  voice: string,
  rate: number,
): EdgeTtsRequestPayload {
  return { text, voice, rate: edgeLocalRatePercent(rate) };
}

export class EdgeLocalConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeLocalConnectionError';
  }
}

export class EdgeLocalServerError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'EdgeLocalServerError';
    this.status = status;
  }
}

const CONNECTION_MESSAGE =
  'Edge 本地语音服务未运行：请先运行 scripts/start-edge-tts.ps1 ' +
  '（或 python scripts/edge-tts-server.py）。';

/** Returns true only when the local edge-tts service answers /health. */
export async function fetchEdgeLocalHealth(
  serverUrl: string,
  timeoutMs = 4_000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serverUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Loads the full voice catalog from the local service. */
export async function fetchEdgeLocalVoices(
  serverUrl: string,
  timeoutMs = 8_000,
): Promise<EdgeLocalVoice[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serverUrl}/voices`, { signal: controller.signal });
    if (!response.ok) {
      throw new EdgeLocalServerError(
        `Edge 语音服务返回了 ${response.status}。`,
        response.status,
      );
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new EdgeLocalServerError('Edge 语音服务返回了无法识别的语音列表。');
    }
    return data
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.name === 'string' &&
          typeof item.locale === 'string',
      )
      .map((item) => ({
        name: item.name as string,
        locale: item.locale as string,
        gender:
          item.gender === 'Female' || item.gender === 'Male' ? item.gender : '',
        friendlyName: typeof item.friendlyName === 'string' ? item.friendlyName : undefined,
      }));
  } catch (error) {
    if (error instanceof EdgeLocalServerError) throw error;
    throw new EdgeLocalConnectionError(CONNECTION_MESSAGE);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Synthesizes one text chunk and returns the complete MP3 payload. */
export async function synthesizeEdgeLocalAudio(
  serverUrl: string,
  text: string,
  voice: string,
  rate: number,
  timeoutMs = 30_000,
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serverUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEdgeTtsPayload(text, voice, rate)),
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `Edge 语音服务返回了 ${response.status}。`;
      try {
        const body: unknown = await response.json();
        if (
          body &&
          typeof body === 'object' &&
          typeof (body as { error?: unknown }).error === 'string'
        ) {
          message = (body as { error: string }).error;
        }
      } catch {
        // Keep the generic status message when the body is not JSON.
      }
      throw new EdgeLocalServerError(message, response.status);
    }
    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof EdgeLocalServerError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new EdgeLocalConnectionError('Edge 语音服务响应超时，请检查网络或服务状态。');
    }
    throw new EdgeLocalConnectionError(CONNECTION_MESSAGE);
  } finally {
    window.clearTimeout(timer);
  }
}

export interface EdgeLocalPlaybackHandle {
  finished: Promise<void>;
  stop(): void;
}

/**
 * Plays one MP3 blob and resolves when it finishes. The handle lets the
 * controller stop it immediately when the user moves to another card.
 */
export function playEdgeLocalAudio(
  data: ArrayBuffer,
  volume: number,
  onStart?: () => void,
): EdgeLocalPlaybackHandle {
  const blob = new Blob([data], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = volume;

  let settled = false;
  let resolveFinished: () => void = () => undefined;
  let rejectFinished: (error: Error) => void = () => undefined;
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  // Prevents an unhandled rejection when a caller only waits for completion.
  void finished.catch(() => undefined);

  const settle = (error?: Error) => {
    if (settled) return;
    settled = true;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
    if (error) rejectFinished(error);
    else resolveFinished();
  };

  audio.addEventListener('ended', () => settle(), { once: true });
  audio.addEventListener(
    'error',
    () => settle(new Error('Edge 本地语音音频播放失败。')),
    { once: true },
  );
  void audio.play().then(
    () => onStart?.(),
    () => {
      settle(
        new Error(
          'Chrome blocked autoplay / 浏览器阻止了自动播放，请点击扬声器按钮启用声音。',
        ),
      );
    },
  );

  return { finished, stop: () => settle() };
}
