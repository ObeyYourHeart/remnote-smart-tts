import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { NATIVE_SETTING_IDS, registerNativeSettings } from '../core/nativeSettings';

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

async function syncQueueAppearance(plugin: ReactRNPlugin): Promise<void> {
  try {
    const replaceControls = (await plugin.settings.getSetting<boolean>(NATIVE_SETTING_IDS.replaceRemNoteTtsControls)) !== false;
    if (replaceControls === lastReplaceControls) return;
    const queueCss = `${QUEUE_CONTROL_POSITION_CSS}${replaceControls ? HIDE_OFFICIAL_TTS_CONTROLS_CSS : ''}`;
    await plugin.app.registerCSS(OFFICIAL_TTS_CSS_ID, queueCss);
    lastReplaceControls = replaceControls;
  } catch (error) {
    console.error('Smart Flashcard TTS could not update the queue appearance.', error);
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  // Everyday controls live in RemNote's own Settings > Plugins page.
  await registerNativeSettings(plugin);
  await syncQueueAppearance(plugin);
  appearancePollId = window.setInterval(() => void syncQueueAppearance(plugin), 1200);

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
    name: 'Smart Flashcard TTS · Advanced Voice Setup / 高级声音设置',
    description: 'Configure local Azure credentials, choose voices, and preview Chinese, English, or Japanese speech.',
    action: async () => plugin.widget.openPopup('settings'),
  });
}

async function onDeactivate(plugin: ReactRNPlugin) {
  if (appearancePollId !== undefined) window.clearInterval(appearancePollId);
  appearancePollId = undefined;
  lastReplaceControls = undefined;
  await plugin.app.registerCSS(OFFICIAL_TTS_CSS_ID, '');

  // Explicit cleanup prevents stale widgets after disabling or updating the plugin.
  await plugin.app.unregisterWidget('settings', WidgetLocation.Popup);
  await plugin.app.unregisterWidget('flashcard-speech', WidgetLocation.FlashcardUnder);
}

declareIndexPlugin(onActivate, onDeactivate);
