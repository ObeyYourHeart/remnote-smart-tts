import type { RNPlugin } from '@remnote/plugin-sdk';
import { useState } from 'react';
import ReactDOM from 'react-dom';
import { SettingsPanel } from '../src/components/settings-panel';
import { SpeechControl } from '../src/components/speech-control';
import { NATIVE_SETTING_IDS } from '../src/core/nativeSettings';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import type { SpeechStatus } from '../src/core/types';
import './preview.css';

// This in-memory RemNote mock powers browser-based visual QA only.
const syncedStorage = new Map<string, unknown>([['card-speech-settings-v1', DEFAULT_SETTINGS]]);
const localStorage = new Map<string, unknown>();
const nativeSettings = new Map<string, unknown>([
  [NATIVE_SETTING_IDS.uiLanguage, 'en'],
  [NATIVE_SETTING_IDS.enabled, true],
  [NATIVE_SETTING_IDS.provider, 'azure'],
  [NATIVE_SETTING_IDS.defaultLanguage, 'zh'],
  [NATIVE_SETTING_IDS.officialTtsDisabledConfirmed, true],
  [NATIVE_SETTING_IDS.autoReadQuestion, true],
  [NATIVE_SETTING_IDS.autoReadAnswer, true],
  [NATIVE_SETTING_IDS.rate, 1],
  [NATIVE_SETTING_IDS.volumePercent, 100],
  [NATIVE_SETTING_IDS.fallbackToBrowser, true],
  [NATIVE_SETTING_IDS.azureRegion, 'eastasia'],
  [NATIVE_SETTING_IDS.clozeZh, '什么'],
  [NATIVE_SETTING_IDS.clozeEn, 'what'],
  [NATIVE_SETTING_IDS.clozeJa, 'なに'],
]);

const mockPlugin = {
  storage: {
    getSynced: async (key: string) => syncedStorage.get(key),
    setSynced: async (key: string, value: unknown) => { syncedStorage.set(key, value); },
    getLocal: async (key: string) => localStorage.get(key),
    setLocal: async (key: string, value: unknown) => { localStorage.set(key, value); },
  },
  settings: {
    getSetting: async (key: string) => nativeSettings.get(key),
  },
  app: {
    toast: async (message: string) => { console.info(`[preview toast] ${message}`); },
  },
  widget: {
    closePopup: async () => { console.info('[preview] close'); },
  },
} as unknown as RNPlugin;

function CardPreview() {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  return (
    <main className="preview-stage">
      <section className="preview-card">
        <span className="preview-card__deck">Good day day</span>
        <p>无锡卡最多的人是 <mark>?</mark></p>
        <SpeechControl
          status={status}
          playLabel="Read this side"
          stopLabel="Stop speaking"
          settingsLabel="Advanced voice setup"
          onPlay={() => setStatus('speaking')}
          onStop={() => setStatus('idle')}
          onOpenSettings={() => console.info('[preview] settings')}
        />
      </section>
    </main>
  );
}

const view = new URLSearchParams(window.location.search).get('view');
ReactDOM.render(view === 'card' ? <CardPreview /> : <SettingsPanel plugin={mockPlugin} />, document.getElementById('root'));
