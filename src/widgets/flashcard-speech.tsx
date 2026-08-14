import {
  AppEvents,
  renderWidget,
  usePlugin,
  WidgetLocation,
  type WidgetLocationContextDataMap,
} from '@remnote/plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechControl } from '../components/speech-control';
import { createCardPlanCacheKey } from '../core/cardPlanCache';
import { buildCardSpeechPlan } from '../core/cards';
import {
  INITIAL_ORDERED_QUEUE_STATE,
  updateOrderedQueueState,
} from '../core/orderedQueue';
import { readAzureKey, readSettings } from '../core/settings';
import { SpeechController } from '../core/speech';
import { formatProviderFallbackNotice } from '../core/speechProvider';
import {
  createSpeechServiceProbe,
  createSpeechRequest,
  createSpeechStop,
  isPersistentSpeechMessage,
  type PersistentSpeechState,
} from '../core/speechMessages';
import type {
  CardSpeechPlan,
  SpeechContent,
  SpeechPlaybackResult,
  SpeechSettings,
  SpeechStatus,
} from '../core/types';
import '../style.css';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

interface PendingSpeechRequest {
  resolve: (result: SpeechPlaybackResult) => void;
  reject: (error: Error) => void;
  acknowledgementTimer: number;
  completionTimer: number;
}

const PERSISTENT_SPEECH_UNAVAILABLE = 'Persistent speech service unavailable.';
const PERSISTENT_ACKNOWLEDGEMENT_MS = 400;
const PERSISTENT_RETRY_COOLDOWN_MS = 30_000;
const PERSISTENT_RETRY_STORAGE_KEY = 'remnote-smart-tts-persistent-retry-after';

function persistentSpeechIsCoolingDown(): boolean {
  try {
    return Number(window.sessionStorage.getItem(PERSISTENT_RETRY_STORAGE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function pausePersistentSpeechRetry(retryAfter = Date.now() + PERSISTENT_RETRY_COOLDOWN_MS): void {
  try {
    window.sessionStorage.setItem(
      PERSISTENT_RETRY_STORAGE_KEY,
      String(retryAfter),
    );
  } catch {
    // Some RemNote sandbox modes disable sessionStorage. The short timeout
    // still prevents a large delay even when the cooldown cannot be saved.
  }
}

function clearPersistentSpeechRetry(): void {
  try {
    window.sessionStorage.removeItem(PERSISTENT_RETRY_STORAGE_KEY);
  } catch {
    // Storage is only a latency optimization, never a playback requirement.
  }
}

const controller = new SpeechController();

function FlashcardSpeechWidget() {
  const plugin = usePlugin();
  const [context, setContext] = useState<FlashcardContext | null>(null);
  const [plan, setPlan] = useState<CardSpeechPlan | null>(null);
  const [settings, setSettings] = useState<SpeechSettings | null>(null);
  const [azureKey, setAzureKey] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('loading');
  const [lastPlaybackResult, setLastPlaybackResult] = useState<SpeechPlaybackResult | null>(null);
  const [lastPlaybackError, setLastPlaybackError] = useState('');
  const contextSignatureRef = useRef('');
  const autoSpokenSignatureRef = useRef('');
  const autoSpeakTimerRef = useRef<number | null>(null);
  const orderedQueueStateRef = useRef(INITIAL_ORDERED_QUEUE_STATE);
  const activePersistentRequestIdRef = useRef<string | null>(null);
  const persistentServiceReadyRef = useRef(false);
  const cardPlanCacheRef = useRef<{ key: string; plan: CardSpeechPlan | null } | null>(null);
  const pendingSpeechRequestsRef = useRef(new Map<string, PendingSpeechRequest>());

  const refresh = useCallback(async (forceSettings = false) => {
    try {
      const nextContext = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
      const queueCardKey = `${nextContext.cardId ?? 'none'}:${nextContext.remId}`;
      // Ordered List-Answer cards keep the parent Rem/Card IDs for every
      // child. The supported SDK exposes no child index, so advance only on
      // the stable answer-to-next-question transition.
      orderedQueueStateRef.current = updateOrderedQueueState(
        orderedQueueStateRef.current,
        queueCardKey,
        nextContext.revealed,
      );
      const [nextSettings, nextAzureKey] = await Promise.all([readSettings(plugin), readAzureKey(plugin)]);
      const planCacheKey = createCardPlanCacheKey(
        queueCardKey,
        orderedQueueStateRef.current.itemIndex,
        nextSettings,
      );
      let nextPlan: CardSpeechPlan | null;
      if (cardPlanCacheRef.current?.key === planCacheKey) {
        nextPlan = cardPlanCacheRef.current.plan;
      } else {
        nextPlan = await buildCardSpeechPlan(plugin, nextContext, nextSettings, {
          structuredItemIndex: orderedQueueStateRef.current.itemIndex,
        });
        cardPlanCacheRef.current = { key: planCacheKey, plan: nextPlan };
      }
      const signature = [planCacheKey, nextContext.revealed].join(':');
      if (!forceSettings && signature === contextSignatureRef.current) return;

      contextSignatureRef.current = signature;
      setContext(nextContext);
      setSettings(nextSettings);
      setAzureKey(nextAzureKey);
      setPlan(nextPlan);
      setStatus('idle');
    } catch (error) {
      console.error('RemNote Smart TTS could not inspect the current card.', error);
      setStatus('error');
    }
  }, [plugin]);

  const handlePersistentSpeechState = useCallback((message: PersistentSpeechState) => {
    const pending = pendingSpeechRequestsRef.current.get(message.requestId);
    if (!pending) return;

    if (message.status === 'accepted') {
      window.clearTimeout(pending.acknowledgementTimer);
      clearPersistentSpeechRetry();
      return;
    }
    if (message.status === 'speaking') {
      window.clearTimeout(pending.acknowledgementTimer);
      setStatus('speaking');
      return;
    }

    window.clearTimeout(pending.acknowledgementTimer);
    window.clearTimeout(pending.completionTimer);
    pendingSpeechRequestsRef.current.delete(message.requestId);
    if (activePersistentRequestIdRef.current === message.requestId) {
      activePersistentRequestIdRef.current = null;
    }

    if (message.status === 'complete' && message.result) pending.resolve(message.result);
    else {
      if (message.error?.startsWith('Chrome blocked autoplay')) {
        // A hidden persistent iframe cannot acquire autoplay permission from
        // the visible card. Skip it for the rest of this page session.
        pausePersistentSpeechRetry(Number.MAX_SAFE_INTEGER);
      }
      pending.reject(new Error(message.error || 'Persistent speech playback failed.'));
    }
  }, []);

  const requestPersistentSpeech = useCallback((content: SpeechContent): Promise<SpeechPlaybackResult> => {
    if (!persistentServiceReadyRef.current || persistentSpeechIsCoolingDown()) {
      return Promise.reject(new Error(PERSISTENT_SPEECH_UNAVAILABLE));
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activePersistentRequestIdRef.current = requestId;

    return new Promise((resolve, reject) => {
      const acknowledgementTimer = window.setTimeout(() => {
        persistentServiceReadyRef.current = false;
        pausePersistentSpeechRetry();
        pendingSpeechRequestsRef.current.delete(requestId);
        if (activePersistentRequestIdRef.current === requestId) activePersistentRequestIdRef.current = null;
        // Stop a listener that acknowledged too late before using the local
        // compatibility path, preventing two voices from playing together.
        void plugin.messaging.broadcast(createSpeechStop(requestId));
        reject(new Error(PERSISTENT_SPEECH_UNAVAILABLE));
      }, PERSISTENT_ACKNOWLEDGEMENT_MS);
      const completionTimer = window.setTimeout(() => {
        pendingSpeechRequestsRef.current.delete(requestId);
        if (activePersistentRequestIdRef.current === requestId) activePersistentRequestIdRef.current = null;
        void plugin.messaging.broadcast(createSpeechStop(requestId));
        reject(new Error('Persistent speech playback timed out.'));
      }, 105_000);

      pendingSpeechRequestsRef.current.set(requestId, {
        resolve,
        reject,
        acknowledgementTimer,
        completionTimer,
      });
      void plugin.messaging.broadcast(createSpeechRequest(requestId, content)).catch(() => {
        persistentServiceReadyRef.current = false;
        window.clearTimeout(acknowledgementTimer);
        window.clearTimeout(completionTimer);
        pendingSpeechRequestsRef.current.delete(requestId);
        if (activePersistentRequestIdRef.current === requestId) activePersistentRequestIdRef.current = null;
        reject(new Error(PERSISTENT_SPEECH_UNAVAILABLE));
      });
    });
  }, [plugin]);

  const stopCurrentSpeech = useCallback(() => {
    controller.cancel();
    const requestId = activePersistentRequestIdRef.current;
    activePersistentRequestIdRef.current = null;
    if (requestId) {
      const pending = pendingSpeechRequestsRef.current.get(requestId);
      if (pending) {
        window.clearTimeout(pending.acknowledgementTimer);
        window.clearTimeout(pending.completionTimer);
        pendingSpeechRequestsRef.current.delete(requestId);
        pending.resolve({ provider: settings?.provider ?? 'azure' });
      }
      void plugin.messaging.broadcast(createSpeechStop(requestId));
    }
    setStatus('idle');
  }, [plugin, settings?.provider]);

  const speakCurrentSide = useCallback(async () => {
    if (!plan || !context || !settings?.enabled) return;
    const content = context.revealed ? plan.answer : plan.question;
    if (!content.text.trim()) return;

    setStatus('preparing');
    setLastPlaybackResult(null);
    setLastPlaybackError('');
    try {
      let result: SpeechPlaybackResult;
      try {
        result = await requestPersistentSpeech(content);
      } catch (error) {
        const localPlaybackCanHelp = error instanceof Error && (
          error.message === PERSISTENT_SPEECH_UNAVAILABLE ||
          error.message.startsWith('Chrome blocked autoplay')
        );
        if (!localPlaybackCanHelp) throw error;
        // The persistent index and the visible card iframe have different
        // autoplay permissions in Chrome. Retry locally only when that context
        // boundary is the actual failure, not for ordinary Azure errors.
        result = await controller.speak(content, settings, azureKey, {
          onPlaybackStart: () => setStatus('speaking'),
        });
      }
      setLastPlaybackResult(result);
      if (result.fallbackReason) {
        await plugin.app.toast(
          formatProviderFallbackNotice(settings.provider, settings.uiLanguage, result.fallbackReason),
        );
      }
      setStatus('idle');
    } catch (error) {
      console.error('RemNote Smart TTS playback failed.', error);
      setStatus('error');
      const rawMessage = error instanceof Error ? error.message : String(error);
      const safeMessage = azureKey ? rawMessage.replaceAll(azureKey, '[redacted]') : rawMessage;
      setLastPlaybackError(safeMessage);
      await plugin.app.toast(
        settings.uiLanguage === 'zh'
          ? `朗读失败：${safeMessage}`
          : `Speech failed: ${safeMessage}`,
      );
    }
  }, [azureKey, context, plan, plugin, requestPersistentSpeech, settings]);

  useEffect(() => {
    void refresh(true);

    const listenerKey = `remnote-smart-tts-${Date.now()}-${Math.random()}`;
    // RemNote emits RevealAnswer just before the revealed card context settles.
    // Read it again shortly afterwards so answer autoplay receives the answer side.
    const handleReveal = () => window.setTimeout(() => void refresh(true), 120);
    const handleQueueLoadCard = () => window.setTimeout(() => void refresh(true), 30);
    // Stop active audio after rating a card, but keep an already-idle Azure
    // session warm for the next card in the same review queue.
    const handleQueueComplete = () => stopCurrentSpeech();
    const handleSettingsChange = () => void refresh(true);
    const handleSpeechMessage = (message: unknown) => {
      if (!isPersistentSpeechMessage(message)) return;
      if (message.type === 'speech-service-ready') {
        persistentServiceReadyRef.current = true;
        clearPersistentSpeechRetry();
        return;
      }
      if (message.type === 'speech-state') handlePersistentSpeechState(message);
    };

    plugin.event.addListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
    plugin.event.addListener(AppEvents.QueueLoadCard, listenerKey, handleQueueLoadCard);
    plugin.event.addListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
    plugin.event.addListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
    plugin.event.addListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);
    plugin.event.addListener(AppEvents.MessageBroadcast, listenerKey, handleSpeechMessage);
    const probeId = `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void plugin.messaging.broadcast(createSpeechServiceProbe(probeId)).catch(() => {
      persistentServiceReadyRef.current = false;
    });

    // A lightweight poll also catches native plugin-setting changes and queue remounts.
    const pollId = window.setInterval(() => void refresh(true), 2500);

    return () => {
      if (autoSpeakTimerRef.current !== null) window.clearTimeout(autoSpeakTimerRef.current);
      window.clearInterval(pollId);
      const activeRequestId = activePersistentRequestIdRef.current;
      if (activeRequestId) void plugin.messaging.broadcast(createSpeechStop(activeRequestId));
      controller.cancel();
      for (const pending of pendingSpeechRequestsRef.current.values()) {
        window.clearTimeout(pending.acknowledgementTimer);
        window.clearTimeout(pending.completionTimer);
      }
      pendingSpeechRequestsRef.current.clear();
      persistentServiceReadyRef.current = false;
      plugin.event.removeListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
      plugin.event.removeListener(AppEvents.QueueLoadCard, listenerKey, handleQueueLoadCard);
      plugin.event.removeListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
      plugin.event.removeListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
      plugin.event.removeListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);
      plugin.event.removeListener(AppEvents.MessageBroadcast, listenerKey, handleSpeechMessage);
    };
  }, [handlePersistentSpeechState, plugin, refresh, stopCurrentSpeech]);

  useEffect(() => {
    if (!plan || !context || !settings?.enabled) return;
    const signature = `${plan.cardId}:${context.revealed}:${orderedQueueStateRef.current.itemIndex}`;
    if (autoSpokenSignatureRef.current === signature) return;

    const shouldAutoRead = context.revealed ? settings.autoReadAnswer : settings.autoReadQuestion;
    if (!shouldAutoRead) return;

    // One short settling window is enough for RemNote to commit the card and
    // Cloze layout without adding a noticeable pause before speech.
    if (autoSpeakTimerRef.current !== null) window.clearTimeout(autoSpeakTimerRef.current);
    autoSpeakTimerRef.current = window.setTimeout(() => {
      autoSpeakTimerRef.current = null;
      autoSpokenSignatureRef.current = signature;
      void speakCurrentSide();
    }, 60);

    return () => {
      if (autoSpeakTimerRef.current !== null) window.clearTimeout(autoSpeakTimerRef.current);
      autoSpeakTimerRef.current = null;
    };
  }, [context, plan, settings, speakCurrentSide]);

  // Keep the compact control visible when a card cannot be interpreted. A
  // disabled button with an explanatory tooltip is easier to diagnose than a
  // completely blank 82x38 widget slot.
  if (!settings?.enabled) return null;
  const chinese = settings?.uiLanguage === 'zh';
  const currentSpeechContent = context?.revealed ? plan?.answer : plan?.question;
  const diagnostics = process.env.NODE_ENV === 'development' && settings
    ? {
      speechText: currentSpeechContent?.text ?? '',
      cardKind: plan?.kind ?? 'unrecognized',
      requestedProvider: settings.provider,
      actualProvider: lastPlaybackResult?.provider,
      fallbackReason: lastPlaybackResult?.fallbackReason || lastPlaybackError || undefined,
      diagnosticReason: lastPlaybackResult?.diagnosticReason,
      planningDiagnostics: plan?.diagnostics,
    }
    : undefined;

  return (
    <SpeechControl
      status={status}
      disabled={!plan}
      playLabel={chinese ? '朗读当前卡片面' : 'Read this side'}
      unavailableLabel={chinese ? '暂时无法识别这张卡片' : 'This card is not recognized yet'}
      preparingLabel={chinese ? '正在准备语音' : 'Preparing speech'}
      stopLabel={chinese ? '停止朗读' : 'Stop speaking'}
      settingsLabel={chinese ? '高级声音设置' : 'Advanced voice setup'}
      onPlay={() => void speakCurrentSide()}
      onStop={stopCurrentSpeech}
      onOpenSettings={() => void plugin.widget.openPopup('settings')}
      diagnostics={diagnostics}
    />
  );
}

renderWidget(FlashcardSpeechWidget);
