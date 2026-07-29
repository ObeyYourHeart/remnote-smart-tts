import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { registerNativeSettings } from '../core/nativeSettings';

async function onActivate(plugin: ReactRNPlugin) {
  // Everyday controls live in RemNote's own Settings > Plugins page.
  await registerNativeSettings(plugin);

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
  // Explicit cleanup prevents stale widgets after disabling or updating the plugin.
  await plugin.app.unregisterWidget('settings', WidgetLocation.Popup);
  await plugin.app.unregisterWidget('flashcard-speech', WidgetLocation.FlashcardUnder);
}

declareIndexPlugin(onActivate, onDeactivate);
