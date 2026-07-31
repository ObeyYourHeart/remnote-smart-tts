import type { SpeechStatus } from '../core/types';

interface SpeechControlProps {
  status: SpeechStatus;
  disabled?: boolean;
  playLabel: string;
  preparingLabel: string;
  stopLabel: string;
  settingsLabel: string;
  onPlay: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

function VoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h3.2L12 6.5v11L7.2 14H4z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.8a7.4 7.4 0 0 1 0 10.4" />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg className="speech-control__spinner" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 8 8" />
    </svg>
  );
}

function PlayingIcon() {
  return (
    <span className="speech-control__wave" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function SpeechControl({
  status,
  disabled,
  playLabel,
  preparingLabel,
  stopLabel,
  settingsLabel,
  onPlay,
  onStop,
  onOpenSettings,
}: SpeechControlProps) {
  const preparing = status === 'preparing';
  const speaking = status === 'speaking';
  const active = preparing || speaking;
  const primaryLabel = preparing ? preparingLabel : speaking ? stopLabel : playLabel;
  return (
    <div className="speech-control" data-status={status} aria-label="Smart Flashcard TTS" aria-live="polite">
      <button
        type="button"
        className="speech-control__primary"
        onClick={active ? onStop : onPlay}
        disabled={disabled || status === 'loading'}
        aria-busy={preparing}
        aria-label={primaryLabel}
        title={primaryLabel}
      >
        <span className="speech-control__pulse" aria-hidden="true" />
        {preparing ? <LoadingIcon /> : speaking ? <PlayingIcon /> : <VoiceIcon />}
      </button>
      <button type="button" className="speech-control__settings" onClick={onOpenSettings} aria-label={settingsLabel} title={settingsLabel}>
        <MoreIcon />
      </button>
    </div>
  );
}
