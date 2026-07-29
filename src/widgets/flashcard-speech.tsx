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
import { readAzureKey, readSettings } from '../core/settings';
import { SpeechController } from '../core/speech';
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

  const refresh = useCallback(async (forceSettings = false) => {
    try {
      const nextContext = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
      const signature = `${nextContext.cardId ?? 'none'}:${nextContext.remId}:${nextContext.revealed}`;
      if (!forceSettings && signature === contextSignatureRef.current) return;

      const [nextSettings, nextAzureKey] = await Promise.all([readSettings(plugin), readAzureKey(plugin)]);
      const nextPlan = await buildCardSpeechPlan(plugin, nextContext, nextSettings);

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

    setStatus('speaking');
    try {
      const result = await controller.speak(content, settings, azureKey);
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
      await plugin.app.toast(
        settings.uiLanguage === 'zh'
          ? '朗读失败。请打开高级声音设置检查声音配置。'
          : 'Speech failed. Open Advanced Voice Setup to check the voice configuration.',
      );
    }
  }, [azureKey, context, plan, plugin, settings]);

  useEffect(() => {
    void refresh(true);

    const listenerKey = `smart-flashcard-tts-${Date.now()}-${Math.random()}`;
    const handleReveal = () => window.setTimeout(() => void refresh(), 40);
    const handleQueueComplete = () => controller.cancel();
    const handleSettingsChange = () => void refresh(true);

    plugin.event.addListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
    plugin.event.addListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
    plugin.event.addListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
    plugin.event.addListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);

    // A lightweight poll also catches native plugin-setting changes and queue remounts.
    const pollId = window.setInterval(() => void refresh(true), 1200);

    return () => {
      window.clearInterval(pollId);
      controller.cancel();
      plugin.event.removeListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
      plugin.event.removeListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
      plugin.event.removeListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
      plugin.event.removeListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);
    };
  }, [plugin, refresh]);

  useEffect(() => {
    if (!plan || !context || !settings?.enabled || !settings.officialTtsDisabledConfirmed) return;
    const signature = `${plan.cardId}:${context.revealed}`;
    if (autoSpokenSignatureRef.current === signature) return;

    const shouldAutoRead = context.revealed ? settings.autoReadAnswer : settings.autoReadQuestion;
    autoSpokenSignatureRef.current = signature;
    if (shouldAutoRead) void speakCurrentSide();
  }, [context, plan, settings, speakCurrentSide]);

  if (!settings?.enabled || (!plan && status !== 'loading')) return null;
  const chinese = settings?.uiLanguage === 'zh';

  return (
    <SpeechControl
      status={status}
      disabled={!plan}
      playLabel={chinese ? '朗读当前卡片面' : 'Read this side'}
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
