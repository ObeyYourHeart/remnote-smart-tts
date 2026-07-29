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

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
}

function StopIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1" /></svg>;
}

function SlidersIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6" /></svg>;
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
        {speaking ? <StopIcon /> : <PlayIcon />}
      </button>
      <span className="speech-control__divider" aria-hidden="true" />
      <button type="button" className="speech-control__settings" onClick={onOpenSettings} aria-label={settingsLabel} title={settingsLabel}>
        <SlidersIcon />
      </button>
    </div>
  );
}
