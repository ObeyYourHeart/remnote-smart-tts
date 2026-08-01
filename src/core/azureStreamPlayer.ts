/**
 * Plays MP3 chunks as Azure returns them. Chrome can normally use MediaSource
 * for immediate playback; the Blob fallback keeps other browsers functional.
 */
export class AzureMp3StreamPlayer {
  private readonly audio = new Audio();
  private readonly mediaSource = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')
    ? new MediaSource()
    : null;
  private readonly chunks: ArrayBuffer[] = [];
  private readonly objectUrl: string | null;
  private sourceBuffer: SourceBuffer | null = null;
  private streamClosed = false;
  private playRequested = false;
  private disposed = false;
  private playbackStartSettled = false;
  private playbackEndSettled = false;
  private resolvePlaybackStart: () => void = () => undefined;
  private rejectPlaybackStart: (error: Error) => void = () => undefined;
  private resolvePlaybackEnd: () => void = () => undefined;
  private rejectPlaybackEnd: (error: Error) => void = () => undefined;

  readonly playbackStarted = new Promise<void>((resolve, reject) => {
    this.resolvePlaybackStart = resolve;
    this.rejectPlaybackStart = reject;
  });

  readonly playbackFinished = new Promise<void>((resolve, reject) => {
    this.resolvePlaybackEnd = resolve;
    this.rejectPlaybackEnd = reject;
  });

  constructor(volume: number, onPlaybackStart?: () => void) {
    // Attach handlers immediately so a fast media error is never unhandled.
    void this.playbackStarted.catch(() => undefined);
    void this.playbackFinished.catch(() => undefined);
    this.audio.volume = volume;
    this.audio.muted = false;
    this.audio.addEventListener('ended', () => this.finishPlayback(), { once: true });
    this.audio.addEventListener('error', () => {
      this.failPlayback(new Error('Azure audio playback failed.'));
    }, { once: true });

    if (this.mediaSource) {
      this.objectUrl = URL.createObjectURL(this.mediaSource);
      this.audio.src = this.objectUrl;
      this.audio.load();
      this.mediaSource.addEventListener('sourceopen', () => {
        if (this.disposed || this.mediaSource?.readyState !== 'open') return;
        try {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
          this.sourceBuffer.addEventListener('updateend', () => {
            this.startPlayback(onPlaybackStart);
            this.pumpChunks(onPlaybackStart);
          });
          this.sourceBuffer.addEventListener('error', () => {
            this.failPlayback(new Error('Azure MP3 stream could not be buffered.'));
          });
          this.pumpChunks(onPlaybackStart);
        } catch (error) {
          this.failPlayback(error instanceof Error ? error : new Error(String(error)));
        }
      }, { once: true });
    } else {
      this.objectUrl = null;
    }
  }

  write(data: ArrayBuffer): void {
    if (this.disposed || data.byteLength === 0) return;
    // Azure may reuse its source buffer after this callback returns.
    this.chunks.push(data.slice(0));
    if (this.mediaSource) this.pumpChunks();
  }

  closeStream(onPlaybackStart?: () => void): void {
    if (this.disposed || this.streamClosed) return;
    this.streamClosed = true;
    if (this.mediaSource) {
      this.pumpChunks(onPlaybackStart);
      return;
    }

    if (this.chunks.length === 0) {
      this.failPlayback(new Error('Azure Speech returned no audio.'));
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob(this.chunks, { type: 'audio/mpeg' }));
    this.audio.src = blobUrl;
    this.audio.addEventListener('ended', () => URL.revokeObjectURL(blobUrl), { once: true });
    this.startPlayback(onPlaybackStart);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private pumpChunks(onPlaybackStart?: () => void): void {
    if (this.disposed || !this.mediaSource || !this.sourceBuffer || this.sourceBuffer.updating) return;
    const nextChunk = this.chunks.shift();
    if (nextChunk) {
      try {
        this.sourceBuffer.appendBuffer(nextChunk);
      } catch (error) {
        this.failPlayback(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    if (this.streamClosed && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
        this.startPlayback(onPlaybackStart);
      } catch (error) {
        this.failPlayback(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private startPlayback(onPlaybackStart?: () => void): void {
    if (this.disposed || this.playRequested) return;
    if (this.mediaSource && (!this.sourceBuffer || this.sourceBuffer.buffered.length === 0)) return;
    this.playRequested = true;
    void this.audio.play().then(() => {
      if (this.disposed || this.playbackStartSettled) return;
      this.playbackStartSettled = true;
      onPlaybackStart?.();
      this.resolvePlaybackStart();
    }, () => {
      this.failPlayback(new Error(
        'Chrome blocked autoplay / Chrome 阻止了自动播放，请点击扬声器按钮启用声音。',
      ));
    });
  }

  private finishPlayback(): void {
    if (this.playbackEndSettled) return;
    this.playbackEndSettled = true;
    this.resolvePlaybackEnd();
  }

  private failPlayback(error: Error): void {
    if (!this.playbackStartSettled) {
      this.playbackStartSettled = true;
      this.rejectPlaybackStart(error);
    }
    if (!this.playbackEndSettled) {
      this.playbackEndSettled = true;
      this.rejectPlaybackEnd(error);
    }
  }
}
