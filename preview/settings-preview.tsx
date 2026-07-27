import type { RNPlugin } from '@remnote/plugin-sdk';
import ReactDOM from 'react-dom';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { SettingsPanel } from '../src/components/settings-panel';

// This tiny in-memory RemNote mock exists only for visual QA of the settings panel.
const syncedStorage = new Map<string, unknown>([['card-speech-settings-v1', DEFAULT_SETTINGS]]);
const localStorage = new Map<string, unknown>();

const mockPlugin = {
  storage: {
    getSynced: async (key: string) => syncedStorage.get(key),
    setSynced: async (key: string, value: unknown) => { syncedStorage.set(key, value); },
    getLocal: async (key: string) => localStorage.get(key),
    setLocal: async (key: string, value: unknown) => { localStorage.set(key, value); },
  },
  app: {
    toast: async (message: string) => { console.info(`[preview toast] ${message}`); },
  },
  widget: {
    closePopup: async () => { console.info('[preview] close'); },
  },
} as unknown as RNPlugin;

ReactDOM.render(<SettingsPanel plugin={mockPlugin} />, document.getElementById('root'));
