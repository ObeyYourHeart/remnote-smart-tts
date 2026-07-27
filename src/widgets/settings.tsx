import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { SettingsPanel } from '../components/settings-panel';

function SettingsWidget() {
  const plugin = usePlugin();
  return <SettingsPanel plugin={plugin} />;
}

renderWidget(SettingsWidget);
