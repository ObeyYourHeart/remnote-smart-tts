import type { SpeechContent, SpeechPlaybackResult } from './types';

const MESSAGE_SCOPE = 'remnote-smart-tts';

export interface PersistentSpeechRequest {
  scope: typeof MESSAGE_SCOPE;
  type: 'speech-request';
  requestId: string;
  sentAt: number;
  content: SpeechContent;
}

export interface PersistentSpeechStop {
  scope: typeof MESSAGE_SCOPE;
  type: 'speech-stop';
  requestId?: string;
}

export interface PersistentSpeechServiceProbe {
  scope: typeof MESSAGE_SCOPE;
  type: 'speech-service-probe';
  probeId: string;
}

export interface PersistentSpeechServiceReady {
  scope: typeof MESSAGE_SCOPE;
  type: 'speech-service-ready';
  serviceId: string;
  probeId?: string;
}

export interface PersistentSpeechState {
  scope: typeof MESSAGE_SCOPE;
  type: 'speech-state';
  requestId: string;
  status: 'accepted' | 'speaking' | 'complete' | 'error';
  result?: SpeechPlaybackResult;
  error?: string;
}

export type PersistentSpeechMessage =
  | PersistentSpeechRequest
  | PersistentSpeechStop
  | PersistentSpeechServiceProbe
  | PersistentSpeechServiceReady
  | PersistentSpeechState;

export function isPersistentSpeechMessage(value: unknown): value is PersistentSpeechMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistentSpeechMessage>;
  return candidate.scope === MESSAGE_SCOPE && typeof candidate.type === 'string';
}

export function createSpeechRequest(requestId: string, content: SpeechContent): PersistentSpeechRequest {
  return { scope: MESSAGE_SCOPE, type: 'speech-request', requestId, sentAt: Date.now(), content };
}

export function createSpeechStop(requestId?: string): PersistentSpeechStop {
  return { scope: MESSAGE_SCOPE, type: 'speech-stop', requestId };
}

export function createSpeechServiceProbe(probeId: string): PersistentSpeechServiceProbe {
  return { scope: MESSAGE_SCOPE, type: 'speech-service-probe', probeId };
}

export function createSpeechServiceReady(
  serviceId: string,
  probeId?: string,
): PersistentSpeechServiceReady {
  return {
    scope: MESSAGE_SCOPE,
    type: 'speech-service-ready',
    serviceId,
    ...(probeId ? { probeId } : {}),
  };
}

export function createSpeechState(
  requestId: string,
  status: PersistentSpeechState['status'],
  details: Pick<PersistentSpeechState, 'result' | 'error'> = {},
): PersistentSpeechState {
  return { scope: MESSAGE_SCOPE, type: 'speech-state', requestId, status, ...details };
}
