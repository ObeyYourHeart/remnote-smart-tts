import type { SpeechStatus } from '../core/types';

interface SpeechControlProps {
  status: SpeechStatus;
  disabled?: boolean;
  playLabel: string;
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

function StopIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1" /></svg>;
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
  stopLabel,
  settingsLabel,
  onPlay,
  onStop,
  onOpenSettings,
}: SpeechControlProps) {
  const speaking = status === 'speaking';
  return (
    <div className="speech-control" data-status={status} aria-label="Smart Flashcard TTS">
      <button
        type="button"
        className="speech-control__primary"
        onClick={speaking ? onStop : onPlay}
        disabled={disabled || status === 'loading'}
        aria-label={speaking ? stopLabel : playLabel}
        title={speaking ? stopLabel : playLabel}
      >
        <span className="speech-control__pulse" aria-hidden="true" />
        {speaking ? <StopIcon /> : <VoiceIcon />}
      </button>
      <button type="button" className="speech-control__settings" onClick={onOpenSettings} aria-label={settingsLabel} title={settingsLabel}>
        <MoreIcon />
      </button>
    </div>
  );
}
