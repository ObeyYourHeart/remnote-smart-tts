import { AppEvents, declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { NATIVE_SETTING_IDS, registerNativeSettings } from '../core/nativeSettings';
import { readAzureKey, readSettings } from '../core/settings';
import { preloadAzureSpeechSdk, SpeechController } from '../core/speech';
import {
  createSpeechState,
  isPersistentSpeechMessage,
  type PersistentSpeechMessage,
} from '../core/speechMessages';

const OFFICIAL_TTS_CSS_ID = 'smart-tts-replace-remnote-controls';
const QUEUE_CONTROL_POSITION_CSS = `
  /* FlashcardUnder is rendered inside the scrolling card body. Visually anchor
     our compact replacement control to the lower edge of that body instead. */
  .rn-queue__content div:has(> div > iframe.rn-plugin-root[src*="widgetName=flashcard-speech"]) {
    position: absolute !important;
    left: 50% !important;
    bottom: 10px !important;
    z-index: 20 !important;
    width: 82px !important;
    height: 38px !important;
    transform: translateX(-50%) !important;
  }

  .rn-queue__content div:has(> div > iframe.rn-plugin-root[src*="widgetName=flashcard-speech"]) > div,
  iframe.rn-plugin-root[src*="widgetName=flashcard-speech"] {
    width: 82px !important;
    height: 38px !important;
  }
`;
const HIDE_OFFICIAL_TTS_CONTROLS_CSS = `
  .spaced-repetition__bottom > .flex.items-center.justify-center.gap-2 {
    display: none !important;
  }
`;

let appearancePollId: number | undefined;
let lastReplaceControls: boolean | undefined;
const speechController = new SpeechController();
const SPEECH_MESSAGE_LISTENER_KEY = 'remnote-smart-tts-persistent-speech';
let activeSpeechRequestId: string | undefined;

async function handleSpeechMessage(plugin: ReactRNPlugin, message: PersistentSpeechMessage): Promise<void> {
  if (message.type === 'speech-stop') {
    if (!message.requestId || message.requestId === activeSpeechRequestId) {
      speechController.cancel();
      activeSpeechRequestId = undefined;
    }
    return;
  }
  if (message.type !== 'speech-request') return;

  // A request that waited too long for the persistent listener is ignored so
  // the card widget can safely use its local compatibility path without echo.
  if (Date.now() - message.sentAt > 1_000) return;
  activeSpeechRequestId = message.requestId;

  try {
    await plugin.messaging.broadcast(createSpeechState(message.requestId, 'accepted'));
    const [settings, azureKey] = await Promise.all([readSettings(plugin), readAzureKey(plugin)]);
    const result = await speechController.speak(message.content, settings, azureKey, {
      onPlaybackStart: () => {
        if (activeSpeechRequestId === message.requestId) {
          void plugin.messaging.broadcast(createSpeechState(message.requestId, 'speaking'));
        }
      },
    });
    if (activeSpeechRequestId !== message.requestId) return;
    activeSpeechRequestId = undefined;
    await plugin.messaging.broadcast(createSpeechState(message.requestId, 'complete', { result }));
  } catch (error) {
    if (activeSpeechRequestId !== message.requestId) return;
    activeSpeechRequestId = undefined;
    const rawMessage = error instanceof Error ? error.message : String(error);
    const safeMessage = await redactAzureKey(plugin, rawMessage);
    await plugin.messaging.broadcast(createSpeechState(message.requestId, 'error', { error: safeMessage }));
  }
}

async function redactAzureKey(plugin: ReactRNPlugin, message: string): Promise<string> {
  try {
    const azureKey = await readAzureKey(plugin);
    return azureKey ? message.replaceAll(azureKey, '[redacted]') : message;
  } catch {
    // If local storage itself is unavailable, avoid forwarding an unknown raw
    // error that could contain credential material.
    return 'Persistent speech service failed.';
  }
}

async function syncQueueAppearance(plugin: ReactRNPlugin): Promise<void> {
  try {
    const replaceControls = (await plugin.settings.getSetting<boolean>(NATIVE_SETTING_IDS.replaceRemNoteTtsControls)) !== false;
    if (replaceControls === lastReplaceControls) return;
    const queueCss = `${QUEUE_CONTROL_POSITION_CSS}${replaceControls ? HIDE_OFFICIAL_TTS_CONTROLS_CSS : ''}`;
    await plugin.app.registerCSS(OFFICIAL_TTS_CSS_ID, queueCss);
    lastReplaceControls = replaceControls;
  } catch (error) {
    console.error('RemNote Smart TTS could not update the queue appearance.', error);
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  // Everyday controls live in RemNote's own Settings > Plugins page.
  await registerNativeSettings(plugin);
  await syncQueueAppearance(plugin);
  appearancePollId = window.setInterval(() => void syncQueueAppearance(plugin), 1200);
  // The index entry stays alive across queue cards, so load the optional Azure
  // runtime here instead of repeating that work inside every card iframe.
  void readSettings(plugin).then((settings) => {
    if (settings.provider === 'azure') return preloadAzureSpeechSdk();
    return undefined;
  }).catch((error) => {
    console.error('RemNote Smart TTS could not preload Azure Speech.', error);
  });
  plugin.event.addListener(AppEvents.MessageBroadcast, SPEECH_MESSAGE_LISTENER_KEY, (message) => {
    if (!isPersistentSpeechMessage(message)) return;
    void handleSpeechMessage(plugin, message).catch((error) => {
      console.error('RemNote Smart TTS persistent speech service failed.', error);
    });
  });

  // This compact popup is only for local credentials, dynamic voices, and previews.
  await plugin.app.registerWidget('settings', WidgetLocation.Popup, {
    dimensions: { width: 680, height: 590 },
  });

  // A minimal control under the card owns manual replay and stop behavior.
  await plugin.app.registerWidget('flashcard-speech', WidgetLocation.FlashcardUnder, {
    dimensions: { width: '100%', height: 'auto' },
  });

  await plugin.app.registerCommand({
    id: 'card-speech-open-settings',
    name: 'RemNote Smart TTS · Advanced Voice Setup / 高级声音设置',
    description: 'Configure local Azure credentials, choose voices, and preview Chinese, English, or Japanese speech.',
    action: async () => plugin.widget.openPopup('settings'),
  });
}

async function onDeactivate(plugin: ReactRNPlugin) {
  if (appearancePollId !== undefined) window.clearInterval(appearancePollId);
  appearancePollId = undefined;
  lastReplaceControls = undefined;
  await plugin.app.registerCSS(OFFICIAL_TTS_CSS_ID, '');
  speechController.dispose();
  plugin.event.removeListener(AppEvents.MessageBroadcast, SPEECH_MESSAGE_LISTENER_KEY);

  // Explicit cleanup prevents stale widgets after disabling or updating the plugin.
  await plugin.app.unregisterWidget('settings', WidgetLocation.Popup);
  await plugin.app.unregisterWidget('flashcard-speech', WidgetLocation.FlashcardUnder);
}

declareIndexPlugin(onActivate, onDeactivate);
