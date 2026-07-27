import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';

async function onActivate(plugin: ReactRNPlugin) {
  // The popup keeps credentials and voice choices out of the flashcard UI.
  await plugin.app.registerWidget('settings', WidgetLocation.Popup, {
    dimensions: { width: 760, height: 680 },
  });

  // A compact strip under the card owns autoplay, replay, and stop behavior.
  await plugin.app.registerWidget('flashcard-speech', WidgetLocation.FlashcardUnder, {
    dimensions: { width: '100%', height: 'auto' },
  });

  await plugin.app.registerCommand({
    id: 'card-speech-open-settings',
    name: 'Card Speech Studio · 打开设置',
    description: '设置中文、英文、日语声音与 Azure Xiaoxiao',
    action: async () => plugin.widget.openPopup('settings'),
  });
}

async function onDeactivate(plugin: ReactRNPlugin) {
  // Explicit cleanup prevents stale widgets after disabling or updating the plugin.
  await plugin.app.unregisterWidget('settings', WidgetLocation.Popup);
  await plugin.app.unregisterWidget('flashcard-speech', WidgetLocation.FlashcardUnder);
}

declareIndexPlugin(onActivate, onDeactivate);
