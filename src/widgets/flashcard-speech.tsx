import {
  AppEvents,
  renderWidget,
  usePlugin,
  WidgetLocation,
  type WidgetLocationContextDataMap,
} from '@remnote/plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechControl } from '../components/speech-control';
import { buildCardSpeechPlan } from '../core/cards';
import {
  INITIAL_ORDERED_QUEUE_STATE,
  updateOrderedQueueState,
} from '../core/orderedQueue';
import { readAzureKey, readSettings } from '../core/settings';
import { preloadAzureSpeechSdk, SpeechController } from '../core/speech';
import type { CardSpeechPlan, SpeechSettings, SpeechStatus } from '../core/types';
import '../style.css';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

const controller = new SpeechController();

function FlashcardSpeechWidget() {
  const plugin = usePlugin();
  const [context, setContext] = useState<FlashcardContext | null>(null);
  const [plan, setPlan] = useState<CardSpeechPlan | null>(null);
  const [settings, setSettings] = useState<SpeechSettings | null>(null);
  const [azureKey, setAzureKey] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('loading');
  const contextSignatureRef = useRef('');
  const autoSpokenSignatureRef = useRef('');
  const autoSpeakTimerRef = useRef<number | null>(null);
  const orderedQueueStateRef = useRef(INITIAL_ORDERED_QUEUE_STATE);

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
      const signature = [
        queueCardKey,
        nextContext.revealed,
        orderedQueueStateRef.current.itemIndex,
      ].join(':');
      if (!forceSettings && signature === contextSignatureRef.current) return;

      const [nextSettings, nextAzureKey] = await Promise.all([readSettings(plugin), readAzureKey(plugin)]);
      if (nextSettings.provider === 'azure') {
        // Load the Azure runtime while RemNote finishes rendering the card.
        void preloadAzureSpeechSdk().catch((error) => {
          console.error('Smart Flashcard TTS could not preload Azure Speech.', error);
        });
      }
      const nextPlan = await buildCardSpeechPlan(plugin, nextContext, nextSettings, {
        structuredItemIndex: orderedQueueStateRef.current.itemIndex,
      });

      contextSignatureRef.current = signature;
      setContext(nextContext);
      setSettings(nextSettings);
      setAzureKey(nextAzureKey);
      setPlan(nextPlan);
      setStatus('idle');
    } catch (error) {
      console.error('Smart Flashcard TTS could not inspect the current card.', error);
      setStatus('error');
    }
  }, [plugin]);

  const speakCurrentSide = useCallback(async () => {
    if (!plan || !context || !settings?.enabled) return;
    const content = context.revealed ? plan.answer : plan.question;
    if (!content.text.trim()) return;

    setStatus('preparing');
    try {
      const result = await controller.speak(content, settings, azureKey, {
        onPlaybackStart: () => setStatus('speaking'),
      });
      if (result.fallbackReason) {
        await plugin.app.toast(
          settings.uiLanguage === 'zh'
            ? 'Azure 暂不可用，已改用浏览器声音。'
            : 'Azure was unavailable, so a browser voice was used.',
        );
      }
      setStatus('idle');
    } catch (error) {
      console.error('Smart Flashcard TTS playback failed.', error);
      setStatus('error');
      const rawMessage = error instanceof Error ? error.message : String(error);
      const safeMessage = azureKey ? rawMessage.replaceAll(azureKey, '[redacted]') : rawMessage;
      await plugin.app.toast(
        settings.uiLanguage === 'zh'
          ? `朗读失败：${safeMessage}`
          : `Speech failed: ${safeMessage}`,
      );
    }
  }, [azureKey, context, plan, plugin, settings]);

  useEffect(() => {
    void refresh(true);

    const listenerKey = `smart-flashcard-tts-${Date.now()}-${Math.random()}`;
    // RemNote emits RevealAnswer just before the revealed card context settles.
    // Read it again shortly afterwards so answer autoplay receives the answer side.
    const handleReveal = () => window.setTimeout(() => void refresh(true), 120);
    const handleQueueLoadCard = () => window.setTimeout(() => void refresh(true), 30);
    const handleQueueComplete = () => controller.cancel();
    const handleSettingsChange = () => void refresh(true);

    plugin.event.addListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
    plugin.event.addListener(AppEvents.QueueLoadCard, listenerKey, handleQueueLoadCard);
    plugin.event.addListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
    plugin.event.addListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
    plugin.event.addListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);

    // A lightweight poll also catches native plugin-setting changes and queue remounts.
    const pollId = window.setInterval(() => void refresh(true), 2500);

    return () => {
      if (autoSpeakTimerRef.current !== null) window.clearTimeout(autoSpeakTimerRef.current);
      window.clearInterval(pollId);
      controller.cancel();
      plugin.event.removeListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
      plugin.event.removeListener(AppEvents.QueueLoadCard, listenerKey, handleQueueLoadCard);
      plugin.event.removeListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
      plugin.event.removeListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
      plugin.event.removeListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);
    };
  }, [plugin, refresh]);

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
      onStop={() => {
        controller.cancel();
        setStatus('idle');
      }}
      onOpenSettings={() => void plugin.widget.openPopup('settings')}
    />
  );
}

renderWidget(FlashcardSpeechWidget);
