import {
  AppEvents,
  renderWidget,
  type ReactRNPlugin,
  usePlugin,
  WidgetLocation,
  type WidgetLocationContextDataMap,
} from '@remnote/plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildCardSpeechPlan } from '../core/cards';
import { readAzureKey, readSettings } from '../core/settings';
import { SpeechController } from '../core/speech';
import type { CardSpeechPlan, SpeechSettings, SpeechStatus } from '../core/types';
import '../style.css';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

const controller = new SpeechController();

function languageLabel(language: 'zh' | 'en' | 'ja'): string {
  return { zh: '中文', en: 'EN', ja: '日本語' }[language];
}

function FlashcardSpeechWidget() {
  const plugin = usePlugin();
  const [context, setContext] = useState<FlashcardContext | null>(null);
  const [plan, setPlan] = useState<CardSpeechPlan | null>(null);
  const [settings, setSettings] = useState<SpeechSettings | null>(null);
  const [azureKey, setAzureKey] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('loading');
  const [message, setMessage] = useState('正在分析卡片…');
  const contextSignatureRef = useRef('');
  const autoSpokenSignatureRef = useRef('');

  const refresh = useCallback(
    async (forceSettings = false) => {
      try {
        const nextContext = await plugin.widget.getWidgetContext<WidgetLocation.FlashcardUnder>();
        const signature = `${nextContext.cardId ?? 'none'}:${nextContext.remId}:${nextContext.revealed}`;
        if (!forceSettings && signature === contextSignatureRef.current) return;

        const [nextSettings, nextAzureKey] = await Promise.all([
          readSettings(plugin),
          readAzureKey(plugin),
        ]);
        const nextPlan = await buildCardSpeechPlan(plugin, nextContext, nextSettings);

        contextSignatureRef.current = signature;
        setContext(nextContext);
        setSettings(nextSettings);
        setAzureKey(nextAzureKey);
        setPlan(nextPlan);
        setStatus('idle');
        setMessage(nextPlan ? '准备就绪' : '当前卡片结构暂未支持');
      } catch (error) {
        console.error('Smart Flashcard TTS could not inspect the current card.', error);
        setStatus('error');
        setMessage('无法读取当前卡片');
      }
    },
    [plugin],
  );

  const speakCurrentSide = useCallback(async () => {
    if (!plan || !context || !settings || !settings.enabled) return;
    const content = context.revealed ? plan.answer : plan.question;
    if (!content.text.trim()) return;

    setStatus('speaking');
    setMessage(context.revealed ? '正在朗读答案' : '正在朗读问题');
    try {
      const result = await controller.speak(content, settings, azureKey);
      if (result.fallbackReason) {
        await plugin.app.toast('Azure 暂不可用，已回退到 Chrome 系统声音。');
      }
      setStatus('idle');
      setMessage('准备就绪');
    } catch (error) {
      console.error('Smart Flashcard TTS playback failed.', error);
      setStatus('error');
      setMessage('播放失败，点重播再试');
      await plugin.app.toast('朗读失败。如果 Chrome 阻止自动播放，请点击卡片下方的重播按钮。');
    }
  }, [azureKey, context, plan, plugin, settings]);

  useEffect(() => {
    void refresh(true);

    const listenerKey = `card-speech-${Date.now()}-${Math.random()}`;
    const handleReveal = () => window.setTimeout(() => void refresh(), 40);
    const handleQueueComplete = () => controller.cancel();
    const handleSettingsChange = () => void refresh(true);

    plugin.event.addListener(AppEvents.RevealAnswer, listenerKey, handleReveal);
    plugin.event.addListener(AppEvents.QueueCompleteCard, listenerKey, handleQueueComplete);
    plugin.event.addListener(AppEvents.StorageSyncedChange, listenerKey, handleSettingsChange);
    plugin.event.addListener(AppEvents.StorageLocalChange, listenerKey, handleSettingsChange);

    // Polling is deliberately slow and only checks lightweight context. It covers RemNote builds
    // that remount or update flashcard widgets without dispatching a typed queue-load event.
    const pollId = window.setInterval(() => void refresh(), 900);

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

  const stop = () => {
    controller.cancel();
    setStatus('idle');
    setMessage('已停止');
  };

  const openSettings = () => plugin.widget.openPopup('settings');
  const currentLanguage = context?.revealed ? plan?.answer.language : plan?.question.language;

  return (
    <div className="speech-dock" data-status={status}>
      <div className="speech-dock__signal" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="speech-dock__copy">
        <div className="speech-dock__eyebrow">
          {settings?.provider === 'azure' ? 'AZURE NEURAL' : 'BROWSER VOICE'}
          {currentLanguage && <span>{languageLabel(currentLanguage)}</span>}
        </div>
        <div className="speech-dock__message">{message}</div>
      </div>

      <div className="speech-dock__actions">
        <button type="button" onClick={() => void speakCurrentSide()} disabled={!plan || status === 'loading'}>
          <span aria-hidden="true">↻</span> 重播
        </button>
        <button type="button" className="speech-dock__stop" onClick={stop} disabled={status !== 'speaking'}>
          <span aria-hidden="true">■</span> 停止
        </button>
        <button type="button" className="speech-dock__settings" onClick={() => void openSettings()} title="打开设置">
          ⚙
        </button>
      </div>
    </div>
  );
}

renderWidget(FlashcardSpeechWidget);
